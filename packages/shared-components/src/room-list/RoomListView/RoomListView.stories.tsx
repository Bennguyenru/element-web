/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { RoomListItem, RoomNotifState } from "../RoomListItem";
import type { MoreOptionsMenuState } from "../RoomListItem/RoomListItemMoreOptionsMenu";
import type { NotificationMenuState } from "../RoomListItem/RoomListItemNotificationMenu";
import type { Filter } from "../RoomListPrimaryFilters";
import { RoomListView, type RoomListViewModel, type RoomListSnapshot } from "./RoomListView";

// Mock avatar component
const mockAvatar = (name: string): React.ReactElement => (
    <div
        style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#0dbd8b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            fontSize: "12px",
        }}
    >
        {name.substring(0, 2).toUpperCase()}
    </div>
);

// Generate mock rooms with data
const generateMockRooms = (count: number): RoomListItem[] => {
    const mockNotificationData = {
        hasAnyNotificationOrActivity: false,
        isUnsentMessage: false,
        invited: false,
        isMention: false,
        isActivityNotification: false,
        isNotification: false,
        muted: false,
    };

    const mockMoreOptionsState: MoreOptionsMenuState = {
        isFavourite: false,
        isLowPriority: false,
        canInvite: true,
        canCopyRoomLink: true,
        canMarkAsRead: true,
        canMarkAsUnread: true,
    };

    const mockNotificationState: NotificationMenuState = {
        isNotificationAllMessage: true,
        isNotificationAllMessageLoud: false,
        isNotificationMentionOnly: false,
        isNotificationMute: false,
    };

    return Array.from({ length: count }, (_, i) => {
        const hasUnread = Math.random() > 0.7;
        const unreadCount = hasUnread ? Math.floor(Math.random() * 10) : 0;
        const hasNotification = Math.random() > 0.8;
        const isMention = Math.random() > 0.9;

        const notificationData = hasUnread
            ? {
                  hasAnyNotificationOrActivity: true,
                  isUnsentMessage: false,
                  invited: false,
                  isMention,
                  isActivityNotification: !hasNotification,
                  isNotification: hasNotification,
                  count: unreadCount,
                  muted: false,
              }
            : mockNotificationData;

        return {
            id: `!room${i}:server`,
            name: `Room ${i + 1}`,
            a11yLabel: unreadCount > 0 ? `Room ${i + 1}, ${unreadCount} unread messages` : `Room ${i + 1}`,
            isBold: unreadCount > 0,
            messagePreview: `Last message in Room ${i + 1}`,
            notification: notificationData,
            showMoreOptionsMenu: true,
            showNotificationMenu: true,
            moreOptionsState: mockMoreOptionsState,
            notificationState: mockNotificationState,
        };
    });
};

const mockFilters: Filter[] = [
    { name: "Unread", active: false },
    { name: "People", active: false },
    { name: "Rooms", active: false },
    { name: "Favourites", active: false },
];

// Create stable unsubscribe function
const noop = (): void => {};

function createMockViewModel(snapshot: RoomListSnapshot): RoomListViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => noop,
        createChatRoom: () => console.log("Create chat room"),
        createRoom: () => console.log("Create room"),
        onOpenRoom: (roomId: string) => console.log("Open room:", roomId),
        onMarkAsRead: (roomId: string) => console.log("Mark as read:", roomId),
        onMarkAsUnread: (roomId: string) => console.log("Mark as unread:", roomId),
        onToggleFavorite: (roomId: string) => console.log("Toggle favorite:", roomId),
        onToggleLowPriority: (roomId: string) => console.log("Toggle low priority:", roomId),
        onInvite: (roomId: string) => console.log("Invite to room:", roomId),
        onCopyRoomLink: (roomId: string) => console.log("Copy room link:", roomId),
        onLeaveRoom: (roomId: string) => console.log("Leave room:", roomId),
        onSetRoomNotifState: (roomId: string, state: RoomNotifState) =>
            console.log("Set notification state:", roomId, state),
        onToggleFilter: (filter) => console.log("Toggle filter:", filter),
    };
}

const renderAvatar = (roomItem: RoomListItem): React.ReactElement => {
    return mockAvatar(roomItem.name);
};

const meta = {
    title: "Room List/RoomListView",
    component: RoomListView,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div
                style={{
                    width: "320px",
                    height: "600px",
                    border: "1px solid var(--cpd-color-border-interactive-primary)",
                    display: "flex",
                    flexDirection: "column",
                    resize: "horizontal",
                    overflow: "auto",
                    minWidth: "250px",
                    maxWidth: "800px",
                }}
            >
                <Story />
            </div>
        ),
    ],
    args: {
        renderAvatar,
    },
} satisfies Meta<typeof RoomListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: mockFilters,
            roomListState: {
                rooms: generateMockRooms(50),
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};

export const Loading: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: true,
            isRoomListEmpty: false,
            filters: mockFilters,
            roomListState: {
                rooms: [],
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};

export const Empty: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: true,
            filters: mockFilters,
            roomListState: {
                rooms: [],
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};

export const EmptyWithoutCreatePermission: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: true,
            filters: mockFilters,
            roomListState: {
                rooms: [],
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: false,
        }),
    },
};

export const WithActiveFilter: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: [
                { name: "Unread", active: false },
                { name: "People", active: false },
                { name: "Rooms", active: false },
                { name: "Favourites", active: true },
            ],
            roomListState: {
                rooms: generateMockRooms(20),
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: ["favourites"],
            },
            canCreateRoom: true,
        }),
    },
};

export const WithSelection: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: mockFilters,
            roomListState: {
                rooms: generateMockRooms(50),
                activeRoomIndex: 10,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};

export const SmallList: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: mockFilters,
            roomListState: {
                rooms: generateMockRooms(5),
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};

export const LargeList: Story = {
    args: {
        vm: createMockViewModel({
            isLoadingRooms: false,
            isRoomListEmpty: false,
            filters: mockFilters,
            roomListState: {
                rooms: generateMockRooms(200),
                activeRoomIndex: undefined,
                spaceId: "!space:server",
                filterKeys: undefined,
            },
            canCreateRoom: true,
        }),
    },
};
