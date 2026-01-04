/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useEffect, useRef, type ReactNode } from "react";
import classNames from "classnames";

import { Flex } from "../../utils/Flex";
import { NotificationDecoration, type NotificationDecorationData } from "./NotificationDecoration";
import {
    RoomListItemHoverMenu,
    type MoreOptionsMenuState,
    type MoreOptionsMenuCallbacks,
    type NotificationMenuState,
} from "./RoomListItemHoverMenu";
import { RoomListItemContextMenu } from "./RoomListItemContextMenu";
import { type RoomNotifState } from "./RoomNotifs";
import styles from "./RoomListItem.module.css";

/**
 * Data interface for a room list item.
 * Contains all the data needed to render a room in the list.
 */
export interface RoomListItem {
    /** Unique identifier for the room (used for list keying) */
    id: string;
    /** The name of the room */
    name: string;
    /** Accessibility label for the room list item */
    a11yLabel: string;
    /** Whether the room name should be bolded (has unread/activity) */
    isBold: boolean;
    /** Optional message preview text */
    messagePreview?: string;
    /** Notification decoration data */
    notification: NotificationDecorationData;
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** More options menu state */
    moreOptionsState: MoreOptionsMenuState;
    /** Notification menu state */
    notificationState: NotificationMenuState;
}

/**
 * Callbacks for room list item interactions
 */
export interface RoomListItemCallbacks {
    /** Callback to open the room */
    onOpenRoom: () => void;
    /** More options menu callbacks */
    moreOptionsCallbacks: MoreOptionsMenuCallbacks;
    /** Set the room notification state */
    onSetRoomNotifState: (state: RoomNotifState) => void;
}

/**
 * Props for RoomListItemView component
 */
export interface RoomListItemViewProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, "onFocus"> {
    /** The room data to display */
    item: RoomListItem;
    /** The room callbacks */
    callbacks: RoomListItemCallbacks;
    /** Whether the room is currently selected */
    isSelected: boolean;
    /** Whether the room is currently focused */
    isFocused: boolean;
    /** Callback when the item receives focus */
    onFocus: (e: React.FocusEvent) => void;
    /** The index of the room in the list (for accessibility) */
    roomIndex: number;
    /** The total number of rooms in the list (for accessibility) */
    roomCount: number;
    /** Custom avatar component to render */
    avatar: ReactNode;
}

/**
 * A presentational room list item component.
 * Displays room name, avatar, message preview, and notifications.
 * All business logic is handled through callbacks to parent components.
 */
export const RoomListItemView = memo(function RoomListItemView({
    item,
    callbacks,
    isSelected,
    isFocused,
    onFocus,
    roomIndex,
    roomCount,
    avatar,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isFocused) {
            ref.current?.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
        }
    }, [isFocused]);

    const content = (
        <Flex
            as="button"
            ref={ref}
            className={classNames(styles.roomListItem, {
                [styles.selected]: isSelected,
                [styles.bold]: item.isBold,
            })}
            gap="var(--cpd-space-3x)"
            align="center"
            type="button"
            role="option"
            aria-posinset={roomIndex + 1}
            aria-setsize={roomCount}
            aria-selected={isSelected}
            aria-label={item.a11yLabel}
            onClick={callbacks.onOpenRoom}
            onFocus={onFocus}
            tabIndex={isFocused ? 0 : -1}
            {...props}
        >
            {avatar}
            <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                <div className={styles.text}>
                    <div className={styles.roomName} title={item.name}>
                        {item.name}
                    </div>
                    {item.messagePreview && (
                        <div className={styles.messagePreview} title={item.messagePreview}>
                            {item.messagePreview}
                        </div>
                    )}
                </div>
                {(item.showMoreOptionsMenu || item.showNotificationMenu) && (
                    <RoomListItemHoverMenu
                        showMoreOptionsMenu={item.showMoreOptionsMenu}
                        showNotificationMenu={item.showNotificationMenu}
                        moreOptionsState={item.moreOptionsState}
                        moreOptionsCallbacks={callbacks.moreOptionsCallbacks}
                        notificationState={item.notificationState}
                        onSetRoomNotifState={callbacks.onSetRoomNotifState}
                    />
                )}

                {/* aria-hidden because we summarise the unread count/notification status in a11yLabel */}
                <div className={styles.notificationDecoration} aria-hidden={true}>
                    <NotificationDecoration data={item.notification} />
                </div>
            </Flex>
        </Flex>
    );

    return (
        <RoomListItemContextMenu state={item.moreOptionsState} callbacks={callbacks.moreOptionsCallbacks}>
            {content}
        </RoomListItemContextMenu>
    );
});
