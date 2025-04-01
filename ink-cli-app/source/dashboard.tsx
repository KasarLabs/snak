import React, {useEffect, useState} from 'react';
import {Text, Box, useFocus, useInput, Key} from 'ink';
import * as fs from 'fs';
import {MultiSelect} from '@inkjs/ui';
import {TabType} from './app.js';

interface DashboardProps {
	onSelectTab: (tab: TabType) => void;
}

export function Dashboard({onSelectTab}: DashboardProps) {
    const [isFirstLaunch, setIsFirstLaunch] = useState(false);
    const [helpAgent, setHelpAgent] = useState(0);
    useEffect(() => {
        function checkFirstLaunch(): boolean {
            try {
                if (!fs.existsSync('./.flag/.flag_firstLaunch')) {
                    // if (!fs.existsSync('./.flag')) {
                    // 	fs.mkdirSync('./.flag', {recursive: true});
                    // }
                    // fs.writeFileSync(
                    // 	'./.flag/.flag_firstLaunch',
                    // 	JSON.stringify({firstLaunch: true}, null, 2),
                    // );
                    return true;
                }
                return false;
            } catch (error) {
                console.error(
                    'Erreur lors de la vérification du premier lancement:',
                    error,
                );
                return false;
            }
        }

        setIsFirstLaunch(checkFirstLaunch());
    }, []);

    useEffect(() => {
        if (helpAgent === 1) {
            onSelectTab('create_agent');
        }
    }, [helpAgent, onSelectTab]);

    function Item({label, value}: {label: string; value?: string}) {
        const {isFocused} = useFocus();
        useInput((input, key) => {
            if (isFocused && (input === ' ' || key.return) && value === 'true') {
                setHelpAgent(1);
            } else if (
                isFocused &&
                (input === ' ' || key.return) &&
                value === 'false'
            ) {
                setHelpAgent(-1);
            }
        });
        return (
            <Text>
                {isFocused ? (
                    <Text color="green">❯ {label}</Text>
                ) : (
                    <Text>{label}</Text>
                )}
            </Text>
        );
    }

    return (
        <Box
            height={40}
            width={'100%'}
            borderStyle={'single'}
            borderColor="blueBright"
            padding={1}
            flexDirection="column"
            justifyContent="flex-start"
        >
            {isFirstLaunch && helpAgent === 0 ? (
                <Box
                    marginY={1}
                    padding={1}
                    borderStyle="round"
                    borderColor="yellow"
                    flexDirection="column"
                >
                    <Text color="yellow">Welcome to Snak, the first AI Engine.</Text>
                    <Text color="yellowBright">
                        Note : It looks like this is your first launch or you haven't set up
                        an agent yet. Do you need help setting it up?
                    </Text>
                    <Box justifyContent="center" marginTop={1}>
                        <Item label="Yes" value={'true'} />
                        <Box width={2} />
                        <Item label="No" value={'false'} />
                    </Box>
                </Box>
            ) : (
                <>
                    <Text bold>Dashboard Content</Text>
                    <Box
                        flexDirection="column"
                        justifyContent="flex-start"
                        padding={1}
                    ></Box>
                </>
            )}
        </Box>
    );
}

export default Dashboard;