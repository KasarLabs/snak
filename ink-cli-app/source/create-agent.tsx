
import React, {PropsWithChildren, useEffect, useState} from 'react';
import {Text, Box, useFocus, useInput, Key} from 'ink';
import Link from 'ink-link';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import * as fs from 'fs';
import {MultiSelect} from '@inkjs/ui';
import Dashboard from './dashboard.js';
import SideBar from './sidebar.js';

function Create_Agent() {
	type InputStepConfig = {
		title: string;
		fieldName: string;
		placeholder?: string;
		placeholderBoolean?: boolean;
		nextStep: number;
		isConfirmation?: false;
	};

	type ConfirmationStepConfig = {
		title: string;
		isConfirmation: true;
	};

	type StepConfig = InputStepConfig | ConfirmationStepConfig;

	const maxfields = 8;

	const [currentStep, setCurrentStep] = useState(1);
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
	const [currentInput, setCurrentInput] = useState<string>('');
	const [error, setError] = useState<string | null>(null);

	const inputRef = React.useRef<any>(null);

	useEffect(() => {
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, [currentStep]);

	// Configuration des étapes avec types appropriés
	const steps: Record<number, StepConfig> = {
		1: {
			title: 'Name your agent',
			fieldName: 'name',
			placeholder: 'Enter agent name...',
			nextStep: 2,
		},
		2: {
			title: 'Write a bio for your agent',
			fieldName: 'bio',
			placeholder: 'Enter bio...',
			nextStep: 3,
		},
		3: {
			title: 'Write a lore for your agent',
			fieldName: 'lore',
			placeholder: 'Enter lore...',
			nextStep: 4,
		},
		4: {
			title: 'Define agent objectives',
			fieldName: 'objectives',
			placeholder: 'Enter objectives...',
			nextStep: 5,
		},
		5: {
			title: 'Define agent knowledge',
			fieldName: 'knowledge',
			placeholder: 'Enter knowledge...',
			nextStep: 6,
		},
		6: {
			title: 'Define agent exection interval in seconds',
			fieldName: 'interval',
			placeholder: 'Enter interval...',
			nextStep: 7,
		},
		7: {
			title: 'Agent internal Tools',
			fieldName: 'tools',
			placeholder: 'Enter tools...',
			nextStep: 8,
		},
		8: {
			title: 'Agent successfully created!',
			isConfirmation: true,
		},
	};

	// Fonction pour gérer la soumission d'une étape
	const handleSubmit = () => {
		const currentStepConfig = steps[currentStep as keyof typeof steps];

		if (currentStepConfig && !('isConfirmation' in currentStepConfig)) {
			if (
				currentInput.trim() !== '' ||
				currentStepConfig.fieldName === 'tools'
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
				} else if (currentStepConfig.fieldName === 'tools') {
					for (const tool of value) {
						agentData.internal_plugins.push(tool);
					}
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

	// Gestionnaire pour les touches
	useInput((input, key) => {
		if (currentStep < maxfields) {
			if (key.return) {
				handleSubmit();
			} else if (key.backspace || key.delete) {
				setCurrentInput(prev => prev.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta && !key.escape) {
				setCurrentInput(prev => prev + input);
			}
		}
	});
	// Fonction pour enregistrer la configuration de l'agent
	function createAgentConfiguration() {
		try {
			// Stocker la configuration dans un fichier ou une base de données
			const agentConfig = {
				...agentData,
				createdAt: new Date().toISOString(),
			};
			fs.writeFileSync(
				`../config/agents/${agentConfig.name}_config.json`,
				JSON.stringify(agentConfig, null, 2),
			);
			console.log('Agent configuration saved:', agentConfig);
		} catch (error) {
			console.error('Error saving agent configuration:', error);
		}
	}
	const [value, setValue] = useState<string[]>([]);

	// Composants pour les différentes étapes
	const renderInputStep = () => {
		const currentStepConfig = steps[currentStep as keyof typeof steps];

		// Vérifier que c'est une étape de saisie
		if (!currentStepConfig || 'isConfirmation' in currentStepConfig) {
			return null;
		}

		return (
			<>
				<Text color="green">
					Step {currentStep}: {currentStepConfig.title}
				</Text>
				{currentStep > 1 && (
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
				)}

				{/* Champ de saisie */}
				{currentStep != 7 && (
					<Box
						marginTop={1}
						height={3}
						borderStyle="single"
						borderColor="blue"
						padding={1}
					>
						<Text>{currentInput}</Text>
					</Box>
				)}
				{/* Champ de saisie pour le dernier champ */}
				{currentStep == 7 && (
					<Box flexDirection="column" gap={1}>
						<MultiSelect
							options={[
								{
									label: 'Rpc',
									value: 'rpc',
								},
								{
									label: 'Argent',
									value: 'argent',
								},
								{
									label: 'Braavos',
									value: 'braavos',
								},
								{
									label: 'Okx',
									value: 'okx',
								},
								{
									label: 'Contract',
									value: 'contract',
								},
								{
									label: 'Token',
									value: 'token',
								},
							]}
							onChange={setValue}
						/>
						<Text>Selected Internal Tools: {value.join(', ')}</Text>
					</Box>
				)}
				<Text color="gray" italic>
					Press Enter to continue
				</Text>
				{error && (
					<Text color="red" italic>
						{error}
					</Text>
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
		return null; // Ne devrait pas arriver avec notre logique actuelle
	};

	// Fonction pour déterminer quel composant afficher
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
			height={40}
			width={'100%'}
			borderStyle={'single'}
			borderColor="blueBright"
			padding={1}
			flexDirection="column"
		>
			<Box marginTop={0} justifyContent="center" height={3}>
				<Text bold>Create Agent</Text>
			</Box>

			<Box
				marginTop={0}
				borderStyle={'single'}
				borderColor="yellowBright"
				height={4}
				padding={1}
			>
				<Text>
					Welcome to Snak Create Agent tools. Here you can create your own
					agent.
				</Text>
			</Box>

			{/* Afficher le composant pour l'étape actuelle */}
			<Box flexDirection="column" marginTop={1} padding={1}>
				{renderCurrentStep()}
			</Box>
		</Box>
	);
}


export default Create_Agent;
