/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import {
    RoomListView as SharedRoomListView,
    useCreateAutoDisposedViewModel,
    type RoomListItem,
} from "@element-hq/web-shared-components";

import { RoomListViewViewModel } from "../../../viewmodels/roomlist/RoomListViewViewModel";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { RoomAvatarView } from "../../avatars/RoomAvatarView";

/**
 * RoomListView component using shared components with proper MVVM pattern.
 */
export function RoomListView(): JSX.Element {
    const matrixClient = useMatrixClientContext();

    // Create and auto-dispose ViewModel instance
    const vm = useCreateAutoDisposedViewModel(() => new RoomListViewViewModel({ client: matrixClient }));

    // Render avatar for each room
    const renderAvatar = (roomItem: RoomListItem): ReactNode => {
        const room = matrixClient.getRoom(roomItem.id);
        if (!room) return null;
        return <RoomAvatarView room={room} />;
    };

    return <SharedRoomListView vm={vm} renderAvatar={renderAvatar} />;
}
