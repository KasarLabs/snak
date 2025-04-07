import React, {PropsWithChildren, useEffect, useRef, useState} from 'react';
import {Text, Box, useFocus, useInput, Key} from 'ink';
import Link from 'ink-link';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import * as fs from 'fs';
import {MultiSelect, ProgressBar} from '@inkjs/ui';
import {nextTick} from 'process';
// import SideBar from './sidebar.js';
// import Create_Agent from './create-agent.js';

export type PageType =
	| 'loading'
	| 'dashboard'
	| 'settings'
	| 'profile'
	| 'welcome'
	| 'setup_agent';

export default function App() {
	const [currentPage, setCurrentPage] = useState<
		'loading' | 'dashboard' | 'settings' | 'profile' | 'welcome' | 'setup_agent'
	>('loading');

	const navigateTo = (
		page:
			| 'loading'
			| 'dashboard'
			| 'settings'
			| 'profile'
			| 'welcome'
			| 'setup_agent',
	) => {
		setCurrentPage(page);
	};

	return (
		<MainLayout>
			{currentPage === 'loading' && <LoadingPage navigateTo={navigateTo} />}
			{currentPage === 'dashboard' && <Dashboard navigateTo={navigateTo} />}
			{currentPage === 'welcome' && <WelcomePage navigateTo={navigateTo} />}
			{currentPage === 'setup_agent' && <SetupAgent navigateTo={navigateTo} />}
		</MainLayout>
	);

	function MainLayout({children}: PropsWithChildren) {
		useInput((input, key) => {
			// if (key.escape) {
			// 	setCurrentPage('loading');
			// }
			if (key.tab) {
			}
		});
		return (
			<Box
				width={'100'}
				// borderStyle={'single'}
				justifyContent="center"
				// borderColor={'green'}
				alignItems="center"
			>
				{children}
			</Box>
		);
	}
}

function LoadingPage({navigateTo}: {navigateTo: (page: PageType) => void}) {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		if (progress >= 100) {
			navigateTo('welcome');
			return () => {};
		}

		const timer = setTimeout(() => {
			setProgress(progress + 1);
		}, 10);

		return () => {
			clearTimeout(timer);
		};
	}, [progress, navigateTo]);

	return (
		<Box
			height={20}
			width={'50%'}
			borderStyle={'single'}
			borderColor="blueBright"
			justifyContent="center"
			flexDirection="column"
			alignItems="center"
			padding={1}
		>
			<Gradient colors={['#000080', '#0000FF', '#1E90FF', '#87CEEB']}>
				<BigText text="Snak" font="block" />
			</Gradient>
			<Box width={30} justifyContent="center" alignItems="center" marginTop={1}>
				<ProgressBar value={progress} />
			</Box>
		</Box>
	);
}
function WelcomePage({navigateTo}: {navigateTo: (page: PageType) => void}) {
	const [helpAgent, setHelpAgent] = useState(0);

	// Déterminer si l'agent est nécessaire en fonction de l'option sélectionnée

	useEffect(() => {
		if (helpAgent === 1) {
			navigateTo('setup_agent');
		} else if (helpAgent === -1) {
			navigateTo('dashboard');
		}
	}, [helpAgent]);

	function Item({label, value}: {label: string; value?: boolean}) {
		const {isFocused} = useFocus();
		useInput((_, key) => {
			if (isFocused && key.return && value === true) {
				setHelpAgent(1);
			} else if (isFocused && key.return && value === false) {
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
			height={20}
			width={'50%'}
			borderStyle={'single'}
			borderColor="blueBright"
			flexDirection="column"
			alignItems="center"
			padding={0}
			paddingTop={3}
		>
			<Box paddingLeft={1} paddingRight={5} gap={1} flexDirection="column">
				<Text color="yellow">Welcome to Snak</Text>
				<Text color="yellow">
					This is where you can imagine and deploy your AI Agents to automate
					and perform any task.
				</Text>
				<Text color="yellow">Want to create your own Agent?</Text>

				<Item label="Yes" value={true} />
				<Item label="No" value={false} />
			</Box>
		</Box>
	);
}

function Dashboard({navigateTo}: {navigateTo: (page: PageType) => void}) {
	return (
		<Box>
			<Box
				height={20}
				width={'50%'}
				borderStyle={'single'}
				borderColor="blueBright"
				justifyContent="center"
				flexDirection="column"
				alignItems="center"
				padding={1}
			>
				<Text
					color="blue"
					underline
					// Utilisation de navigateTo en réponse à un événement
				>
					Aller à la page d'accueil
				</Text>
			</Box>
		</Box>
	);
}

function SetupAgent({navigateTo}: {navigateTo: (page: PageType) => void}) {
	const [currentStep, setCurrentStep] = useState(1);
	const [isConfirmation, setIsConfirmation] = useState(false);
	const [currentInput, setCurrentInput] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [focusedIndex, setFocusedIndex] = useState(0);
	const [focusableItems, setFocusableItems] = useState([
		{id: 'input', label: 'Input', position: 'center'},
		{id: 'prev', label: '←', position: 'bottom-left'},
		{id: 'next', label: '→', position: 'bottom-right'},
	]);

	useEffect(() => {
		if (currentStep === 7) {
			const focusable_item = {
				id: 'confirm_tools',
				label: 'Confirm',
				position: 'center',
			};
			// Also, fix your spread syntax - you're creating an object, not an array
			setFocusableItems(prev => [...prev, focusable_item]);
		}
	}, [currentStep]);

	const [suggestion, setSuggestion] = useState('');
	const [tools_list, setTools] = useState([]);
	type FocusableOption = 'next' | 'prev' | 'input';
	const [agentData, setAgentData] = useState({
		name: '',
		bio: '',
		lore: '',
		objectives: '',
		knowledge: '',
		interval: 0,
		internal_plugins: [] as string[],
		autonomous: true,
		chat_id: 'sak_guide',
		mcp: false,
	});

	const steps = {
		1: {
			fieldName: 'agent_name',
			title: 'Agent Name',
			placeholder: 'Enter your agent name',
			question: 'How would you like to call your Agent?',
			nextStep: 2,
		},
		2: {
			fieldName: 'agent_bio',
			title: 'Agent Bio',
			placeholder: 'Enter bio for your agent',
			question: 'Write a short bio to describe what your agent does',
			nextStep: 3,
		},
		3: {
			fieldName: 'agent_lore',
			title: 'Agent Lore',
			placeholder: 'Enter lore for your agent',
			question: 'Define the background story of your agent',
			nextStep: 4,
		},
		4: {
			fieldName: 'agent_objectives',
			title: 'Agent Objectives',
			placeholder: 'Enter objectives for your agent',
			question: 'What are the main objectives your agent should accomplish?',
			nextStep: 5,
		},
		5: {
			fieldName: 'agent_knowledge',
			title: 'Agent Knowledge',
			placeholder: 'Enter knowledge for your agent',
			question: 'What specific knowledge should your agent have?',
			nextStep: 6,
		},
		6: {
			fieldName: 'agent_interval',
			title: 'Execution Interval',
			placeholder: 'Enter interval in seconds',
			question: 'How often should your agent run (in seconds)?',
			nextStep: 7,
		},
		7: {
			fieldName: 'agent_tools',
			title: 'Internal Tools',
			placeholder: 'Enter tools for your agent',
			question: 'What tools should your agent have access to?',
			nextStep: 8,
		},
		8: {
			fieldName: 'agent_confirmation',
			title: 'Confirmation',
			question: 'Your agent has been successfully created!',
			isConfirmation: true,
		},
	};

	function createAgentConfiguration() {
		try {
			const agentConfig = {
				...agentData,
				createdAt: new Date().toISOString(),
			};
			fs.writeFileSync(
				`../config/agents/${agentConfig.name}_config.json`,
				JSON.stringify(agentConfig, null, 2),
			);
			// console.log('Agent configuration saved:', agentConfig);
		} catch (error) {
			console.error('Error saving agent configuration:', error);
		}
	}

	const tools = {
		twitter: {
			name: 'twitter',
			description: 'Twtter API for social media interactions',
		},
		telegram: {
			name: 'telegram',
			description: 'Telegram',
		},
		argent: {
			name: 'argent',
			description: 'Argent Wallet for Ethereum and StarkNet',
		},
		fibrous: {
			name: 'fibrous',
			description: 'Fibrous Protocol for DeFi operations',
		},
		okx: {
			name: 'okx',
			description: 'OKX Exchange and Wallet services',
		},
		braavos: {
			name: 'braavos',
			description: 'Braavos Wallet for StarkNet',
		},
		openzeppelin: {
			name: 'openzeppelin',
			description: 'OpenZeppelin security tools and libraries',
		},
		rpc: {
			name: 'rpc',
			description: 'Remote Procedure Call API endpoints',
		},
		transaction: {
			name: 'transaction',
			description: 'Blockchain transaction management',
		},
		avnu: {
			name: 'avnu',
			description: 'Avnu DEX aggregator for StarkNet',
		},
		erc20: {
			name: 'erc20',
			description: 'ERC-20 token standard implementation',
		},
		erc721: {
			name: 'erc721',
			description: 'ERC-721 NFT standard implementation',
		},
		scarb: {
			name: 'scarb',
			description: 'Scarb package manager for Cairo',
		},
		contract: {
			name: 'contract',
			description: 'Smart contract deployment and interaction',
		},
		atlantic: {
			name: 'atlantic',
			description: 'Atlantic Finance protocol',
		},
	};
	const addTools = (tool: string) => {
		if (tools[tool]) {
			if (!agentData.internal_plugins.includes(tool)) {
				tools[tool].enabled = true;
				setAgentData(prev => ({
					...prev,
					internal_plugins: [...prev.internal_plugins, tool],
				}));
				setCurrentInput('');
			} else {
				tools[tool].enabled = false;
				setAgentData(prev => ({
					...prev,
					internal_plugins: prev.internal_plugins.filter(
						(item: string) => item !== tool,
					),
				}));
				setCurrentInput('');
			}
		} else {
		}
	};
	const handleSubmit = () => {
		const currentStepConfig = steps[currentStep as keyof typeof steps];

		if (currentStepConfig && !('isConfirmation' in currentStepConfig)) {
			if (
				currentInput.trim() !== '' ||
				currentStepConfig.fieldName === 'agent_tools'
			) {
				const fieldName = currentStepConfig.fieldName as keyof typeof agentData;

				if (currentStepConfig.fieldName === 'interval') {
					const data = parseInt(currentInput, 10);
					if (isNaN(data)) {
						setCurrentInput('');
						setError('Please enter a valid number');
						return;
					}
					setAgentData(prev => ({
						...prev,
						[fieldName]: parseInt(currentInput, 10),
					}));
				} else {
					setAgentData(prev => ({
						...prev,
						[fieldName]: currentInput,
					}));
				}

				setCurrentInput('');
				setCurrentStep(currentStepConfig.nextStep);

				if (currentStepConfig.nextStep === maxfields) {
					createAgentConfiguration();
				}
			}
		}
	};
	const maxfields = 8;
	type color =
		| 'green'
		| 'red'
		| 'yellow'
		| 'blue'
		| 'cyan'
		| 'magenta'
		| 'white';
	function FocusableItem({
		label,
		value,
		color,
	}: {
		label: string;
		value: string;
		color?: color;
	}) {
		if (value === focusableItems[focusedIndex].id) {
			return (
				<Text color={color ? color : 'white'} bold={true} underline={true}>
					{label}
				</Text>
			);
		}
		return (
			<Text color={color ? color : 'white'} bold={false} underline={false}>
				{label}
			</Text>
		);
	}

	useInput((input, key) => {
		if (currentStep < maxfields) {
			// Navigation entre les éléments
			if (key.leftArrow) {
				setFocusedIndex(
					prevIndex =>
						(prevIndex - 1 + focusableItems.length) % focusableItems.length,
				);
			} else if (key.rightArrow) {
				setFocusedIndex(prevIndex => (prevIndex + 1) % focusableItems.length);
			}
			// Action sur l'élément en focus
			else if (
				key.return &&
				focusableItems[focusedIndex].id === 'input' &&
				currentStep < 7
			) {
				handleSubmit();
			} else if (
				key.return &&
				focusableItems[focusedIndex].id === 'input' &&
				currentStep === 7
			) {
				addTools(currentInput);
				setCurrentInput('');
			} else if (key.return && focusableItems[focusedIndex].id === 'prev') {
				setCurrentInput('');
				setCurrentStep(prev => (prev > 1 ? prev - 1 : prev));
				setFocusedIndex(0);
			} else if (key.return && focusableItems[focusedIndex].id === 'next') {
				setCurrentInput('');
				setCurrentStep(prev => (prev < maxfields ? prev + 1 : prev));
				setFocusedIndex(0);
			} else if (
				key.return &&
				focusableItems[focusedIndex].id === 'confirm_tools'
			) {
				handleSubmit();
			} else if (
				(key.backspace || key.delete) &&
				focusableItems[focusedIndex].id === 'input'
			) {
				if (currentStep === 7) {
					const matchedTool = getAutoCompleteSuggestion(currentInput, tools);
					setSuggestion(matchedTool);
				}
				setCurrentInput(prev => prev.slice(0, -1));
			} else if (
				input &&
				!key.ctrl &&
				!key.meta &&
				!key.escape &&
				focusableItems[focusedIndex].id === 'input'
			) {
				if (currentStep === 7) {
					const matchedTool = getAutoCompleteSuggestion(currentInput, tools);
					setSuggestion(matchedTool);
				}
				setCurrentInput(prev => prev + input);
			}
		} else if (
			key.return &&
			steps[currentStep].fieldName === 'agent_confirmation'
		) {
			navigateTo('dashboard');
		}
	});

	interface Tool {
		name: string;
		description: string;
	}

	type Tools = Record<string, Tool>;

	/**
	 * Returns the closest matching tool name based on the user's input
	 * @param input The current user input to match against tool names
	 * @param tools The object containing all available tools
	 * @returns The closest matching tool name or empty string if no matches
	 */
	function getAutoCompleteSuggestion(input: string, tools: Tools): string {
		// If input is empty, don't suggest anything
		if (!input.trim()) {
			return '';
		}

		// Convert input to lowercase for case-insensitive matching
		const lowercaseInput = input.toLowerCase();

		// First look for tools that start with the input (prefix match)
		const prefixMatches = Object.keys(tools).filter(toolKey =>
			toolKey.toLowerCase().startsWith(lowercaseInput),
		);

		// If we have prefix matches, return the first one (shortest match)
		if (prefixMatches.length > 0) {
			// Sort by length to get the shortest match first
			prefixMatches.sort((a, b) => a.length - b.length);
			return prefixMatches[0];
		}

		// If no prefix matches, look for tools that contain the input anywhere
		const containsMatches = Object.keys(tools).filter(toolKey =>
			toolKey.toLowerCase().includes(lowercaseInput),
		);

		// If we have contains matches, return the first one
		if (containsMatches.length > 0) {
			// Sort by length to get the shortest match first
			containsMatches.sort((a, b) => a.length - b.length);
			return containsMatches[0];
		}

		// No matches found
		return '';
	}

	const renderInputStep = () => {
		const currentStepConfig = steps[currentStep as keyof typeof steps];

		if (!currentStepConfig || 'isConfirmation' in currentStepConfig) {
			return null;
		}

		return (
			<>
				<Box
					// borderStyle="round"
					padding={1}
					marginBottom={1}
					justifyContent="center"
				>
					<Text color="yellow" bold={true}>
						{steps[currentStep].question}
					</Text>
				</Box>
				{/* {currentStep > 1 && (
					<Box flexDirection="column" marginY={1}>
						{Object.entries(agentData)
							.filter(
								([key, value]) =>
									key !== currentStepConfig.fieldName &&
									!(Array.isArray(value) && value.length === 0) &&
									!!value,
							)
							.map(([key, value]) => (
								<Text key={key} color="gray">
									{key.charAt(0).toUpperCase() + key.slice(1)}:{' '}
									<Text color="white">{value}</Text>
								</Text>
							))}
					</Box>
				)} */}
				<Box
					marginTop={1}
					borderStyle="round"
					borderColor={'gray'}
					borderDimColor={true}
					alignItems="flex-start"
					marginBottom={1}
					paddingLeft={1} // Aligne les éléments au début horizontalement
				>
					{currentInput === '' ? (
						<Text bold={true} dimColor={true}>
							{steps[currentStep].placeholder}...
						</Text>
					) : (
						<>
							<Text>{currentInput}</Text>
							{suggestion && suggestion !== currentInput && (
								<Text dimColor={true}>
									{suggestion.slice(currentInput.length)}
								</Text>
							)}
						</>
					)}
				</Box>
				{currentStep === 7 && (
					<>
						<Text> Avaiable Tools and MCP's : </Text>
						<Box
							borderStyle="round"
							borderColor={'gray'}
							borderDimColor={true}
							alignItems="flex-start"
							paddingLeft={1} // Aligne les éléments au début horizontalement
						>
							<Text underline={true}>
								twitter-telegram-fibrous-rpc-mcp-contract-transaction-token-erc20-cairo-erc721
							</Text>
						</Box>
						<Box
							borderStyle="round"
							borderColor={'gray'}
							borderDimColor={true}
							alignItems="flex-start"
							flexDirection="column"
							paddingLeft={1} // Aligne les éléments au début horizontalement
						>
							<Text>The MCP's and Tools you add : </Text>
							<Text color={'green'}>
								{agentData.internal_plugins.join(', ')}
							</Text>
						</Box>
						<Box justifyContent="center" marginTop={1}>
							<FocusableItem
								label="Confirm"
								value="confirm_tools"
								color="green"
							/>
						</Box>
					</>
				)}
			</>
		);
	};

	const renderConfirmation = () => {
		if (steps[maxfields]) {
			return (
				<Box
					borderStyle="round"
					borderColor="green"
					padding={1}
					flexDirection="column"
				>
					<Text color="green" bold>
						{steps[maxfields].title}
					</Text>
					<Box flexDirection="column" marginTop={1}>
						{Object.entries(agentData).map(([key, value]) => (
							<Text key={key}>
								{key.charAt(0).toUpperCase() + key.slice(1)}:{' '}
								<Text bold={key === 'name'}>{value}</Text>
							</Text>
						))}
					</Box>
				</Box>
			);
		}
		return null;
	};

	const renderCurrentStep = () => {
		const currentStepConfig = steps[currentStep as keyof typeof steps];

		if (!currentStepConfig || 'isConfirmation' in currentStepConfig) {
			return renderConfirmation();
		} else {
			return renderInputStep();
		}
	};

	return (
		<Box
			width={'65%'}
			// borderStyle={'single'}
			// borderColor="blueBright"
			justifyContent="center"
			gap={1}
			flexDirection="row"
			marginRight={1}
		>
			<Box
				height={25}
				width={'35%'}
				borderStyle={'round'}
				borderColor={'blueBright'}
				justifyContent="center"
				flexDirection="column"
				position="relative"
			>
				<Box
					height={10}
					justifyContent="center"
					marginLeft={3}
					marginRight={3}
					alignItems="center"
					flexDirection="column"
				>
					<Gradient colors={['#000080', '#0000FF', '#1E90FF', '#87CEEB']}>
						<BigText text="Sn" font="block" />
					</Gradient>
					<Box marginTop={0}>
						<Link url="https://kasar.io/">
							{' '}
							powered by <Text color="cyan">Kasar™</Text>
						</Link>
					</Box>
				</Box>
			</Box>
			<Box
				height={25}
				width={'65%'}
				borderStyle={'round'}
				borderColor="yellow"
				position="relative"
				flexDirection="column"
			>
				{renderCurrentStep()}

				{/* Container for navigation buttons */}
				<Box
					position="absolute"
					marginTop={21}
					width="100%"
					display="flex"
					flexDirection="row"
					justifyContent="space-between"
					padding={1}
				>
					{/* Left button (prev) */}
					<Box>
						<FocusableItem label="<--" value={'prev'} />
					</Box>

					{/* Right button (next) */}
					<Box>
						<FocusableItem label="-->" value="next" />
					</Box>
				</Box>
			</Box>
		</Box>
	);
}

{
	/* <Box
				height={25}
				width={'35%'}
				borderStyle={'single'}
				borderColor={'blueBright'}
				justifyContent="center"
				flexDirection="column"
				position="absolute"
			>
				<Box
					height={10}
					justifyContent="center"
					marginLeft={3}
					marginRight={3}
					alignItems="center"
					flexDirection='column'
				>
					<Gradient colors={['#000080', '#0000FF', '#1E90FF', '#87CEEB']}>
						<BigText text="Sn" font="block" />
					</Gradient>
					<Box marginTop={0}>
						<Link url="https://kasar.io/">
							powered by <Text color="cyan">Kasar™</Text>
						</Link>
					</Box>
				</Box>
			</Box>
			<Box
				height={25}
				width={'65%'}
				borderStyle={'round'}
				borderColor="blueBright"
				position="relative" // Ajout de cette propriété
			></Box> */
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
			width={'100%'}
			borderStyle={'single'}
			borderColor="blueBright"
			justifyContent="center"
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
