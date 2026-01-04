/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    type RoomListSnapshot,
    type Filter,
    type RoomListItem,
    type RoomNotifState,
    type RoomListViewActions,
    type RoomListViewState,
} from "@element-hq/web-shared-components";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { _t, _td, type TranslationKey } from "../../../languageHandler";
import { UPDATE_SELECTED_SPACE } from "../../../stores/spaces";
import { Action } from "../../../dispatcher/actions";
import dispatcher from "../../../dispatcher/dispatcher";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import SpaceStore from "../../../stores/spaces/SpaceStore";
import RoomListStoreV3, { RoomListStoreV3Event, type RoomsResult } from "../../../stores/room-list-v3/RoomListStoreV3";
import { FilterKey } from "../../../stores/room-list-v3/skip-list/filters";
import {
    RoomNotificationStateStore,
    UPDATE_STATUS_INDICATOR,
} from "../../../stores/notifications/RoomNotificationStateStore";
import { RoomNotificationState } from "../../../stores/notifications/RoomNotificationState";
import { MessagePreviewStore } from "../../../stores/room-list/MessagePreviewStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { DefaultTagID } from "../../../stores/room-list/models";
import { clearRoomNotification, setMarkedUnreadState } from "../../../utils/notifications";
import { tagRoom } from "../../../utils/room/tagRoom";
import DMRoomMap from "../../../utils/DMRoomMap";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import { hasAccessToNotificationMenu, hasAccessToOptionsMenu, hasCreateRoomRights } from "./utils";
import { EchoChamber } from "../../../stores/local-echo/EchoChamber";
import { RoomNotifState as ElementRoomNotifState } from "../../../RoomNotifs";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import SettingsStore from "../../../settings/SettingsStore";
import { CallStore, CallStoreEvent } from "../../../stores/CallStore";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import PosthogTrackers from "../../../PosthogTrackers";

interface RoomListViewViewModelProps {
    client: MatrixClient;
}

const filterKeyToNameMap: Map<FilterKey, TranslationKey> = new Map([
    [FilterKey.UnreadFilter, _td("room_list|filters|unread")],
    [FilterKey.PeopleFilter, _td("room_list|filters|people")],
    [FilterKey.RoomsFilter, _td("room_list|filters|rooms")],
    [FilterKey.FavouriteFilter, _td("room_list|filters|favourite")],
    [FilterKey.MentionsFilter, _td("room_list|filters|mentions")],
    [FilterKey.InvitesFilter, _td("room_list|filters|invites")],
    [FilterKey.LowPriorityFilter, _td("room_list|filters|low_priority")],
]);

/**
 * Simplified ViewModel for RoomListView only (no header).
 * Implements RoomListViewActions to provide room action callbacks.
 */
export class RoomListViewViewModel
    extends BaseViewModel<RoomListSnapshot, RoomListViewViewModelProps>
    implements RoomListViewActions
{
    // State tracking
    private activeFilter: FilterKey | undefined = undefined;
    private roomsResult: RoomsResult;

    public constructor(props: RoomListViewViewModelProps) {
        const activeSpace = SpaceStore.instance.activeSpaceRoom;

        // Get initial rooms
        const roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(undefined);
        const canCreateRoom = hasCreateRoomRights(props.client, activeSpace);

        super(props, {
            // Initial view state
            isLoadingRooms: RoomListStoreV3.instance.isLoadingRooms,
            isRoomListEmpty: roomsResult.rooms.length === 0,
            filters: RoomListViewViewModel.createFilters(undefined),
            roomListState: RoomListViewViewModel.createRoomListState(roomsResult, props.client),
            canCreateRoom,
        });

        this.roomsResult = roomsResult;

        // Subscribe to space changes
        this.disposables.trackListener(SpaceStore.instance, UPDATE_SELECTED_SPACE as any, this.onSpaceChanged);

        // Subscribe to room list updates
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsUpdate as any,
            this.onListsUpdate,
        );

        // Subscribe to room list loaded
        this.disposables.trackListener(
            RoomListStoreV3.instance,
            RoomListStoreV3Event.ListsLoaded as any,
            this.onListsLoaded,
        );

        // Subscribe to notification state changes
        this.disposables.trackListener(
            RoomNotificationStateStore.instance,
            UPDATE_STATUS_INDICATOR as any,
            this.onNotificationUpdate,
        );

        // Subscribe to message preview changes
        this.disposables.trackListener(MessagePreviewStore.instance, UPDATE_EVENT, this.onMessagePreviewUpdate);

        // Subscribe to message preview setting changes
        const watcherId = SettingsStore.watchSetting("RoomList.showMessagePreview", null, () => {
            this.updateRoomListData();
        });
        this.disposables.track(() => SettingsStore.unwatchSetting(watcherId));

        // Subscribe to call state changes (for call participants in rooms)
        this.disposables.trackListener(
            CallStore.instance,
            CallStoreEvent.ConnectedCalls as any,
            this.onCallStateChanged,
        );
    }

    // ==================== Filters ====================

    private static createFilters(activeFilter: FilterKey | undefined): Filter[] {
        const filters = [];

        for (const [key, name] of filterKeyToNameMap.entries()) {
            filters.push({
                name: _t(name),
                active: activeFilter === key,
            });
        }

        return filters;
    }

    public onToggleFilter = (filter: Filter): void => {
        // Find the FilterKey by matching the filter name
        let filterKey: FilterKey | undefined = undefined;
        for (const [key, name] of filterKeyToNameMap.entries()) {
            if (_t(name) === filter.name) {
                filterKey = key;
                break;
            }
        }

        if (filterKey === undefined) return;

        // Toggle the filter - if it's already active, deactivate it
        const newFilter = this.activeFilter === filterKey ? undefined : filterKey;
        this.activeFilter = newFilter;

        // Update rooms result with new filter
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomListData();
    };

    // ==================== Room List State ====================

    private static async createRoomListState(roomsResult: RoomsResult, client: MatrixClient): Promise<RoomListViewState> {
        // Transform rooms into RoomListItems
        const roomListItems: RoomListItem[] = await Promise.all(
            roomsResult.rooms.map((room) => RoomListViewViewModel.roomToListItem(room, client)),
        );

        return {
            rooms: roomListItems,
            activeRoomIndex: undefined,
            spaceId: roomsResult.spaceId,
            filterKeys: roomsResult.filterKeys?.map((k) => String(k)),
        };
    }

    private static async roomToListItem(room: Room, client: MatrixClient): Promise<RoomListItem> {
        const notifState = RoomNotificationStateStore.instance.getRoomState(room);

        // Get room tags for menu state
        const roomTags = room.tags;
        const isDm = Boolean(DMRoomMap.shared().getUserIdForRoomId(room.roomId));

        // Get message preview respecting user setting and using correct tag (same as old ViewModel)
        const shouldShowMessagePreview = SettingsStore.getValue("RoomList.showMessagePreview");
        const messagePreviewTag = isDm ? DefaultTagID.DM : DefaultTagID.Untagged;
        const messagePreview = shouldShowMessagePreview
            ? await MessagePreviewStore.instance.getPreviewForRoom(room, messagePreviewTag)
            : undefined;
        const isFavourite = Boolean(roomTags[DefaultTagID.Favourite]);
        const isLowPriority = Boolean(roomTags[DefaultTagID.LowPriority]);
        const isArchived = Boolean(roomTags[DefaultTagID.Archived]);

        // More options menu state
        const showMoreOptionsMenu = hasAccessToOptionsMenu(room);
        const showNotificationMenu = hasAccessToNotificationMenu(room, client.isGuest(), isArchived);

        // Notification levels
        const canMarkAsRead = notifState.level > NotificationLevel.None;
        const canMarkAsUnread = !canMarkAsRead && !isArchived;

        const canInvite = room.canInvite(client.getUserId()!) && !isDm && shouldShowComponent(UIComponent.InviteUsers);
        const canCopyRoomLink = !isDm;

        // Get the current room notification state from EchoChamber
        const echoChamber = EchoChamber.forRoom(room);
        const roomNotifState = echoChamber.notificationVolume;

        // Determine which notification option is active
        const isNotificationAllMessage = roomNotifState === ElementRoomNotifState.AllMessages;
        const isNotificationAllMessageLoud = roomNotifState === ElementRoomNotifState.AllMessagesLoud;
        const isNotificationMentionOnly = roomNotifState === ElementRoomNotifState.MentionsOnly;
        const isNotificationMute = roomNotifState === ElementRoomNotifState.Mute;

        // Generate accessible label based on notification state
        const a11yLabel = RoomListViewViewModel.getA11yLabel(room.name, notifState);

        // Video room and call state tracking
        // Check if there's an active call with participants
        const call = CallStore.instance.getCall(room.roomId);
        const participantCount = call?.participants.size ?? 0;
        const hasParticipantsInCall = participantCount > 0;
        const callType = call?.callType === CallType.Voice ? "voice" : call?.callType === CallType.Video ? "video" : undefined;

        return {
            id: room.roomId,
            name: room.name,
            a11yLabel,
            isBold: notifState.hasAnyNotificationOrActivity,
            messagePreview: messagePreview?.text,
            notification: {
                hasAnyNotificationOrActivity: notifState.hasAnyNotificationOrActivity || hasParticipantsInCall,
                isUnsentMessage: notifState.isUnsentMessage,
                invited: notifState.invited,
                isMention: notifState.isMention,
                isActivityNotification: notifState.isActivityNotification,
                isNotification: notifState.isNotification,
                count: notifState.count > 0 ? notifState.count : undefined,
                muted: isNotificationMute,
                callType: hasParticipantsInCall ? callType : undefined,
            },
            showMoreOptionsMenu,
            showNotificationMenu,
            moreOptionsState: {
                isFavourite,
                isLowPriority,
                canInvite,
                canCopyRoomLink,
                canMarkAsRead,
                canMarkAsUnread,
            },
            notificationState: {
                isNotificationAllMessage,
                isNotificationAllMessageLoud,
                isNotificationMentionOnly,
                isNotificationMute,
            },
        };
    }

    // ==================== Event Handlers ====================

    private onSpaceChanged = (): void => {
        // Update rooms list
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomListData();
    };

    private onListsUpdate = (): void => {
        // Update rooms list
        const filterKeys = this.activeFilter !== undefined ? [this.activeFilter] : undefined;
        this.roomsResult = RoomListStoreV3.instance.getSortedRoomsInActiveSpace(filterKeys);
        this.updateRoomListData();
    };

    private onListsLoaded = (): void => {
        // Room lists have finished loading
        this.snapshot.merge({
            isLoadingRooms: false,
        });
    };

    private onNotificationUpdate = (): void => {
        // Notification states changed, update room list items
        this.updateRoomListData();
    };

    private onMessagePreviewUpdate = (): void => {
        // Message previews changed, update room list items
        this.updateRoomListData();
    };

    private onCallStateChanged = (): void => {
        // Call state changed (participants joined/left), update room list items
        this.updateRoomListData();
    };

    private async updateRoomListData(): Promise<void> {
        // Update the snapshot with fresh room list data
        const filters = RoomListViewViewModel.createFilters(this.activeFilter);
        const roomListState = await RoomListViewViewModel.createRoomListState(this.roomsResult, this.props.client);
        const isRoomListEmpty = this.roomsResult.rooms.length === 0;
        const isLoadingRooms = RoomListStoreV3.instance.isLoadingRooms;

        this.snapshot.merge({
            isLoadingRooms,
            isRoomListEmpty,
            filters,
            roomListState,
        });
    }

    /**
     * Generate an accessible label for a room based on its notification state.
     * This provides screen reader users with context about unread messages, mentions, etc.
     */
    private static getA11yLabel(roomName: string, notificationState: RoomNotificationState): string {
        if (notificationState.isUnsentMessage) {
            return _t("a11y|room_messsage_not_sent", {
                roomName,
            });
        } else if (notificationState.invited) {
            return _t("a11y|room_n_unread_invite", {
                roomName,
            });
        } else if (notificationState.isMention) {
            return _t("a11y|room_n_unread_messages_mentions", {
                roomName,
                count: notificationState.count,
            });
        } else if (notificationState.hasUnreadCount) {
            return _t("a11y|room_n_unread_messages", {
                roomName,
                count: notificationState.count,
            });
        } else {
            return _t("room_list|room|open_room", { roomName });
        }
    }

    // ==================== Room Action Handlers ====================

    public onOpenRoom = (roomId: string): void => {
        dispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "RoomList",
        });
    };

    public onMarkAsRead = async (roomId: string): Promise<void> => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        await clearRoomNotification(room, this.props.client);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuMarkRead");
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onMarkAsUnread = async (roomId: string): Promise<void> => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        await setMarkedUnreadState(room, this.props.client, true);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuMarkUnread");
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onToggleFavorite = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.Favourite);
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuFavouriteToggle");
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onToggleLowPriority = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        tagRoom(room, DefaultTagID.LowPriority);
        // Trigger immediate update for optimistic UI
        this.updateRoomListData();
    };

    public onInvitePeople = (roomId: string): void => {
        dispatcher.dispatch({
            action: "view_invite",
            roomId: roomId,
        });
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuInviteItem");
    };

    // Alias for backwards compatibility
    public onInvite = this.onInvitePeople;

    public onCopyRoomLink = (roomId: string): void => {
        dispatcher.dispatch({
            action: "copy_room",
            room_id: roomId,
        });
    };

    public onRoomSettings = (roomId: string): void => {
        dispatcher.dispatch({
            action: "open_room_settings",
            room_id: roomId,
        });
    };

    public onLeaveRoom = (roomId: string): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;
        const isArchived = Boolean(room.tags[DefaultTagID.Archived]);
        dispatcher.dispatch({
            action: isArchived ? "forget_room" : "leave_room",
            room_id: roomId,
        });
        PosthogTrackers.trackInteraction("WebRoomListRoomTileContextMenuLeaveItem");
    };

    public onSetRoomNotifState = (roomId: string, notifState: RoomNotifState): void => {
        const room = this.props.client.getRoom(roomId);
        if (!room) return;

        // Convert shared-components RoomNotifState to element-web RoomNotifState
        let elementNotifState: ElementRoomNotifState;
        switch (notifState) {
            case "all_messages":
                elementNotifState = ElementRoomNotifState.AllMessages;
                break;
            case "all_messages_loud":
                elementNotifState = ElementRoomNotifState.AllMessagesLoud;
                break;
            case "mentions_only":
                elementNotifState = ElementRoomNotifState.MentionsOnly;
                break;
            case "mute":
                elementNotifState = ElementRoomNotifState.Mute;
                break;
            default:
                elementNotifState = ElementRoomNotifState.AllMessages;
        }

        // Set the notification state using EchoChamber
        const echoChamber = EchoChamber.forRoom(room);
        echoChamber.notificationVolume = elementNotifState;

        // The RoomNotificationStateStore will emit UPDATE_STATUS_INDICATOR
        // when the notification state changes, which will trigger updateRoomListData()
        // No need for manual update here
    };

    // ==================== Room Creation ====================

    public createChatRoom = (): void => {
        dispatcher.fire(Action.CreateChat);
    };

    public createRoom = (): void => {
        const activeSpace = SpaceStore.instance.activeSpaceRoom;
        if (activeSpace) {
            dispatcher.dispatch({
                action: Action.CreateRoom,
                parent_space: activeSpace,
            });
        } else {
            dispatcher.dispatch({
                action: Action.CreateRoom,
            });
        }
    };
}
