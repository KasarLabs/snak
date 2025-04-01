import React, {useEffect, useState} from 'react';
import {Text, Box, useFocus, useInput, Key} from 'ink';
import * as fs from 'fs';
import {MultiSelect} from '@inkjs/ui';
import {TabType} from './app.js';

interface SideBarProps {
    activeTab: TabType;
    onSelectTab: (tab: TabType) => void;
}

function SideBar({activeTab, onSelectTab}: SideBarProps) {
    interface ItemProps {
        label: string;
        value: TabType;
        isActive: boolean;
    }

    function ItemBar({label, value, isActive}: ItemProps) {
        const {isFocused} = useFocus({isActive: true});

        useInput((input, key) => {
            if (isFocused && (input === ' ' || key.return)) {
                onSelectTab(value);
            }
        });

        return (
            <Text>
                {isFocused ? (
                    <Text color="green">❯ {label}</Text>
                ) : (
                    <Text color={isActive ? 'blue' : undefined}>
                        {isActive ? '▶' : ''} {label}
                    </Text>
                )}
            </Text>
        );
    }

    return (
        <Box height={40} borderStyle={'single'} width={40} borderColor="blueBright">
            <Box flexDirection="column" justifyContent="flex-start" padding={1}>
                <ItemBar
                    label="Dashboard"
                    value="dashboard"
                    isActive={activeTab === 'dashboard'}
                />
                <ItemBar label="Agent" value="agent" isActive={activeTab === 'agent'} />
                <ItemBar
                    label="Parameters"
                    value="parameters"
                    isActive={activeTab === 'parameters'}
                />
                <ItemBar label="Help" value="help" isActive={activeTab === 'help'} />
                <ItemBar
                    label="Create Agent"
                    value="create_agent"
                    isActive={activeTab === 'create_agent'}
                />
            </Box>
        </Box>
    );
}

export default SideBar;