import React, {PropsWithChildren, useEffect, useState} from 'react';
import {Text, Box, useFocus, useInput, Key} from 'ink';
import Link from 'ink-link';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import * as fs from 'fs';
import {MultiSelect} from '@inkjs/ui';
import Dashboard from './dashboard.js';
import SideBar from './sidebar.js';
import Create_Agent from './create-agent.js';

export type TabType =
	| 'dashboard'
	| 'agent'
	| 'parameters'
	| 'help'
	| 'create_agent';

export default function App() {
	const [activeTab, setActiveTab] = useState<TabType>('dashboard');

	return (
		<MainLayout>
			<Header />
			<Box flexDirection="row" borderStyle={'round'} borderColor={'blueBright'}>
				{/* <SideBar activeTab={activeTab} onSelectTab={setActiveTab} />
				{activeTab === 'dashboard' && <Dashboard onSelectTab={setActiveTab} />}
				{activeTab === 'agent' && <Agent />}
				{activeTab === 'parameters' && <Parameters />}
				{activeTab === 'help' && (
					<Help options={['test']} onSelect={() => {}} />
				)}
				{activeTab === 'create_agent' && <Create_Agent />} */}
			</Box>
		</MainLayout>
	);
}

function MainLayout({children}: PropsWithChildren) {
	return <Box flexDirection="column">{children}</Box>;
}

function Agent() {
	const Grid = ({children, columns}: {children: any; columns: any}) => {
		return (
			<Box flexDirection="row" flexWrap="wrap">
				{React.Children.map(children, child => (
					<Box width={`${100 / columns}%`}>{child}</Box>
				))}
			</Box>
		);
	};

	const GridItem = ({children}: any) => (
		<Box padding={1}>
			<Text>{children}</Text>
		</Box>
	);
	return (
		<Box
			height={40}
			width={'100%'}
			borderStyle={'single'}
			borderColor="blueBright"
			padding={1}
		>
			<Text bold>Agent Content</Text>
			<Box marginTop={1}>
				<Text>Configuration et gestion de votre agent.</Text>
			</Box>
			<Grid columns={3}>
				<GridItem>Item 1</GridItem>
				<GridItem>Item 2</GridItem>
				<GridItem>Item 3</GridItem>
				<GridItem>Item 4</GridItem>
				<GridItem>Item 5</GridItem>
				<GridItem>Item 6</GridItem>
			</Grid>
		</Box>
	);
}

function Parameters() {
	return (
		<Box
			height={40}
			width={'100%'}
			borderStyle={'single'}
			borderColor="blueBright"
			padding={1}
		>
			<Text bold>Parameters Content</Text>
			<Box marginTop={1}>
				<Text>Configurez les paramètres de votre application.</Text>
			</Box>
		</Box>
	);
}

function Help({options, onSelect}: {options: any; onSelect: any}) {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput((input, key) => {
		input;
		if (key.upArrow) {
			setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
		}
		if (key.downArrow) {
			setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
		}
		if (key.return) {
			onSelect(options[selectedIndex]);
		}
	});

	return (
		<Box flexDirection="column">
			{options.map((option: any, index: any) => (
				<Text key={index} color={selectedIndex === index ? 'green' : 'white'}>
					{selectedIndex === index ? '> ' : '  '}
					{option}7
				</Text>
			))}
		</Box>
	);
}

function Header() {
	return (
		<Box
			borderStyle={'single'}
			borderColor="blueBright"
			width="100%"
			alignItems="center"
			justifyContent="center"
			flexDirection="column"
		>
			<Gradient colors={['#000080', '#0000FF', '#1E90FF', '#87CEEB']}>
				<BigText text="Snak" font="block" />
			</Gradient>
			<Box marginTop={0}>
				<Link url="https://kasar.io/">
					powered by <Text color="cyan">Kasar™</Text>
				</Link>
			</Box>
		</Box>
	);
}
