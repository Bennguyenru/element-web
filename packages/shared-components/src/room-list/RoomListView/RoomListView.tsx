/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";

import { useViewModel } from "../../useViewModel";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { RoomListPrimaryFilters, type Filter } from "../RoomListPrimaryFilters";
import { RoomListLoadingSkeleton } from "./RoomListLoadingSkeleton";
import { RoomListEmptyState } from "./RoomListEmptyState";
import { RoomList, type RoomListViewState } from "../RoomList";
import { type RoomListItem, type RoomNotifState } from "../RoomListItem";

/**
 * Snapshot for the room list view
 */
export type RoomListSnapshot = {
    /** Whether the rooms are currently loading */
    isLoadingRooms: boolean;
    /** Whether the room list is empty */
    isRoomListEmpty: boolean;
    /** Array of filter data */
    filters: Filter[];
    /** Room list state */
    roomListState: RoomListViewState;
    /** Optional description for the empty state */
    emptyStateDescription?: string;
    /** Optional action element for the empty state */
    emptyStateAction?: ReactNode;
    /** Whether the user can create rooms */
    canCreateRoom?: boolean;
};

/**
 * Actions interface for room list operations
 */
export interface RoomListViewActions {
    /** Called when a filter is toggled */
    onToggleFilter: (filter: Filter) => void;
    /** Called when a room should be opened */
    onOpenRoom: (roomId: string) => void;
    /** Called when a room should be marked as read */
    onMarkAsRead: (roomId: string) => void;
    /** Called when a room should be marked as unread */
    onMarkAsUnread: (roomId: string) => void;
    /** Called when a room's favorite status should be toggled */
    onToggleFavorite: (roomId: string) => void;
    /** Called when a room's low priority status should be toggled */
    onToggleLowPriority: (roomId: string) => void;
    /** Called when inviting users to a room */
    onInvite: (roomId: string) => void;
    /** Called when copying a room link */
    onCopyRoomLink: (roomId: string) => void;
    /** Called when leaving a room */
    onLeaveRoom: (roomId: string) => void;
    /** Called when setting room notification state */
    onSetRoomNotifState: (roomId: string, notifState: RoomNotifState) => void;
    /** Called to create a new chat room */
    createChatRoom: () => void;
    /** Called to create a new room */
    createRoom: () => void;
}

/**
 * The view model type for the room list view
 */
export type RoomListViewModel = ViewModel<RoomListSnapshot> & RoomListViewActions;

/**
 * Props for RoomListView component
 */
export interface RoomListViewProps {
    /** The view model containing all data and callbacks */
    vm: RoomListViewModel;
    /** Render function for room avatar */
    renderAvatar: (roomItem: RoomListItem) => ReactNode;
}

/**
 * Room list view component that manages filters, loading states, empty states, and the room list.
 */
export const RoomListView: React.FC<RoomListViewProps> = ({ vm, renderAvatar }): JSX.Element => {
    const snapshot = useViewModel(vm);
    let listBody: ReactNode;

    if (snapshot.isLoadingRooms) {
        listBody = <RoomListLoadingSkeleton />;
    } else if (snapshot.isRoomListEmpty) {
        listBody = <RoomListEmptyState vm={vm} />;
    } else {
        listBody = <RoomList vm={vm} renderAvatar={renderAvatar} />;
    }

    return (
        <>
            <RoomListPrimaryFilters filters={snapshot.filters} onToggleFilter={vm.onToggleFilter} />
            {listBody}
        </>
    );
};
