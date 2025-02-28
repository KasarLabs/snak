'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Send, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MarkdownIt from 'markdown-it';
import { WalletAccount } from 'starknet';
import { connectWallet } from '@/app/wallet/wallet';
import { AiOutlineSignature, AiFillSignature } from 'react-icons/ai';
import {
  AgentResponse,
  TransactionResponse,
} from '@/interfaces/starknetagents';
import { handleInvokeTransactions } from '@/transactions/InvokeTransactions';
import { ACCOUNT } from '@/interfaces/accout';
import { InvokeTransaction } from '@/types/starknetagents';
import { handleDeployTransactions } from '@/transactions/DeployAccountTransactions';
import { CreateOutputRequest } from '@/output/output';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileInfo } from '../interfaces/fileInfo';
import UploadFile from './ui/uploadFile';

const md = new MarkdownIt({ breaks: true });

const StarknetAgent = () => {
  const [input, setInput] = useState('');
  const [currentResponse, setCurrentResponse] = useState<AgentResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingMessage, setShowLoadingMessage] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [Wallet, setWallet] = useState<WalletAccount | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('normal');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);

  // When in loading state for >5s, we show "Processing..."
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isLoading) {
      timeoutId = setTimeout(() => {
        setShowLoadingMessage(true);
      }, 5000);
    } else {
      setShowLoadingMessage(false);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading]);

  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      if (address == undefined) {
        throw new Error('wallet connect fail');
      }
      setIsConnected(true);
      setWallet(address);
      console.log('Connected');
    } catch (error) {
      console.log('Error', error);
    }
  };

  const handleClick = () => {
    setIsActive(!isActive);
  };

  const handleSubmitButton = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(isActive);
    if (isActive === true) {
      handleSubmitWallet(e);
    } else {
      handleSubmit(e);
    }
  };

  /**
   * Shorten a full StarkNet/Ethereum transaction hash (0x + 64 hex chars)
   * e.g. "0x0123abcd...ffff" => "0x01...fff"
   */
  const shortenTxHash = (hash: string) => {
    // "0x" (2 chars) + 2 + "..." + 3 = total ~10 visible chars
    return `0x${hash.slice(2, 4)}...${hash.slice(-3)}`;
  };

  /**
   * Shorten any URL, e.g. https://example.com/very/long/path => example.com/...
   */
  const shortenUrl = (url: string) => {
    try {
      const { hostname } = new URL(url);
      return `${hostname}/...`;
    } catch {
      // Fallback: if parsing fails, just return the original (or do something else)
      return url;
    }
  };

  /**
   * Convert transaction hashes and links into shortened clickable text.
   *
   * - If it's a direct hash like "0xabc123...." => link to https://starkscan.co/tx/{hash}
   * - If it's already a Starkscan link => use that link directly
   * - If it's any other URL => make it clickable + shorten
   */
  const parseAndDisplayWithShortLinks = (text: string) => {
    // Matches:
    // 1) https://starkscan.co/tx/0x + 64 hex chars
    // 2) 0x + 64 hex chars (standalone hash)
    // 3) any http(s):// link
    const regex =
      /((?:https?:\/\/starkscan\.co\/tx\/0x[a-fA-F0-9]{64})|0x[a-fA-F0-9]{64}|https?:\/\/[^\s]+)/g;
    const parts: Array<string | React.ReactElement> = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const found = match[0];
      const start = match.index;
      const end = regex.lastIndex;

      // Push the text before this match
      parts.push(text.slice(lastIndex, start));

      // Determine how to create the link
      if (found.startsWith('0x') && found.length === 66) {
        // It's a standalone hash (0x + 64 hex chars).
        // Link to starkscan using the full hash:
        const shortened = shortenTxHash(found);
        parts.push(
          <a
            key={start}
            href={`https://starkscan.co/contract/${found}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 underline"
          >
            {shortened}
          </a>
        );
      } else if (found.includes('starkscan.co/tx/0x')) {
        // It's already a Starkscan link
        // Optionally parse out the raw hash for the display:
        const rawHash = found.split('/tx/')[1] ?? '';
        const shortened =
          rawHash.startsWith('0x') && rawHash.length === 66
            ? shortenTxHash(rawHash)
            : shortenUrl(found);
        parts.push(
          <a
            key={start}
            href={found}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 underline"
          >
            {shortened}
          </a>
        );
      } else if (found.startsWith('http')) {
        // Generic link: just shorten for display
        parts.push(
          <a
            key={start}
            href={found}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 underline"
          >
            {shortenUrl(found)}
          </a>
        );
      } else {
        // Fallback — in case something is matched unexpectedly
        parts.push(found);
      }

      lastIndex = end;
    }

    // Push any remaining text after the last match
    parts.push(text.slice(lastIndex));

    return parts;
  };

  /**
   * Strip away known extraneous OpenAI formatting from the JSON response.
   */
  const formatResponse = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);

      // Extract the text content from the response
      let extractedText = '';

      // Handle the result structure from your backend
      if (data.result?.output?.[0]?.text) {
        extractedText = data.result.output[0].text;
      }
      // Handle direct output structure
      else if (data.output?.[0]?.text) {
        extractedText = data.output[0].text;
      }
      // Handle direct text
      else if (typeof data === 'string') {
        extractedText = data;
      }

      // Clean up extra newlines and whitespace
      extractedText = extractedText.trim();

      // Convert markdown to HTML
      return md.render(extractedText);
    } catch (error) {
      console.error('Error formatting response:', error);
      return jsonString;
    }
  };

  /**
   * Simulate typing in the UI.
   */
  const getResponseText = async (text: string): Promise<string> => {
    if (selectedStyle === 'only-value') {
      return text;
    }
    const output_text = await CreateOutputRequest(text);
    return output_text;
  };

  const typeResponse = async (response: AgentResponse) => {
    console.log(response);
    const text = await getResponseText(response.text);
    let currentIndex = 0;

    const typingInterval = setInterval(() => {
      setCurrentResponse((prevResponse) => {
        if (!prevResponse) return prevResponse;
        return {
          ...prevResponse,
          text: text.slice(0, currentIndex + 1),
          isTyping: currentIndex < text.length - 1,
        };
      });

      currentIndex++;
      if (currentIndex >= text.length) {
        clearInterval(typingInterval);
      }
    }, 10);
  };

  const handleSubmitWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setShowLoadingMessage(false);

    const newResponse = {
      text: '',
      timestamp: Date.now(),
      isTyping: true,
    };

    setCurrentResponse(newResponse);
    try {
      // If file is detected we send it to the server
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const resp = await fetch('/api/wallet/upload_large_file', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
          },
          body: formData,
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('API Error:', {
            status: resp.status,
            statusText: resp.statusText,
            body: errorText,
          });
          throw new Error(errorText);
        }
      }

      const response = await fetch('/api/wallet/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
        },
        body: JSON.stringify({ request: input }),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (!Wallet) {
        throw new Error('Wallet not initialized. Please connect your wallet.');
      }

      // If file is detected we send delete request to the server
      if (selectedFile) {
        const del = await fetch('api/wallet/delete_large_file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
          },
          body: JSON.stringify({ filename: selectedFile.name }),
          credentials: 'include',
        });

        if (!del.ok) {
          const errorText = await response.text();
          console.error('API error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
        }
      }

      const result = await response.json();

      let tx;
      if (result.transaction_type === 'INVOKE') {
        tx = handleInvokeTransactions(result as TransactionResponse);
        if (!tx) {
          throw new Error(
            'The Invoke transaction is in the wrong format. Check the API Response'
          );
        }
        const transaction_hash = await Wallet.execute(tx);
        typeResponse({
          ...newResponse,
          text: JSON.stringify(JSON.stringify({ tx, transaction_hash })),
        });
      } else if (result.transaction_type === 'READ') {
        typeResponse({
          ...newResponse,
          text: JSON.stringify(JSON.stringify(result)),
        });
      } else if (
        result.transaction_type === 'CREATE_ACCOUNT' &&
        result.status === 'success'
      ) {
        const account_details = result as ACCOUNT;
        if (!account_details) {
          throw new Error('Account not set');
        }
        const tx: InvokeTransaction = {
          contractAddress:
            '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
          entrypoint: 'transfer',
          calldata: [
            account_details.contractAddress,
            account_details.deployFee,
            '0x0',
          ],
        };
        const deploy_account_response = handleDeployTransactions(
          Wallet,
          tx,
          result.wallet,
          account_details.publicKey,
          account_details.privateKey,
          account_details.contractAddress
        );

        typeResponse({
          ...newResponse,
          text: await deploy_account_response,
        });
      }
      if (
        !tx &&
        result.transaction_type != 'READ' &&
        result.transaction_type != 'CREATE_ACCOUNT'
      ) {
        throw new Error(
          'The transactions has to be an INVOKE or DeployAccount transaction'
        );
      }
    } catch (error) {
      console.error('Request error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      typeResponse({
        ...newResponse,
        text: `Error: ${errorMessage}\nPlease try again or contact support if the issue persists.`,
      });
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    setShowLoadingMessage(false);

    const newResponse = {
      text: '',
      timestamp: Date.now(),
      isTyping: true,
    };

    setCurrentResponse(newResponse);

    try {
      // If file is detected we send it to the server
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const resp = await fetch('/api/key/upload_large_file', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
          },
          body: formData,
        });
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('API Error:', {
            status: resp.status,
            statusText: resp.statusText,
            body: errorText,
          });
          throw new Error(errorText);
        }
      }
      const response = await fetch('/api/key/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
        },
        body: JSON.stringify({ request: input }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(errorText);
      }

      const data = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      const formattedText = formatResponse(JSON.stringify(data));
      typeResponse({ ...newResponse, text: formattedText });

      // If file is detected we send delete request to the server
      if (selectedFile) {
        const del = await fetch('api/key/delete_large_file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_SERVER_API_KEY || '',
          },
          body: JSON.stringify({ filename: selectedFile.name }),
          credentials: 'include',
        });

        if (!del.ok) {
          const errorText = await response.text();
          console.error('API error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
        }
      }
    } catch (error) {
      console.error('Request error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';

      typeResponse({
        ...newResponse,
        text: `Error: ${errorMessage}\nPlease try again or contact support if the issue persists.`,
      });
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg -mt-32 flex flex-col gap-4 md:gap-8">
        <div className="flex items-center gap-3 md:gap-4 px-2 md:px-0">
          <div className="relative w-8 h-8 md:w-10 md:h-10">
            <Image
              src="https://pbs.twimg.com/profile_images/1834202903189618688/N4J8emeY_400x400.png"
              alt="Starknet Logo"
              fill
              className="rounded-full object-cover"
            />
          </div>
          <h1 className="text-lg md:text-2xl font-semibold text-white">
            Starknet Agent
          </h1>
        </div>

        {!isConnected ? (
          <button
            onClick={handleConnect}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            ConnectWallet
          </button>
        ) : (
          <Card className="w-full bg-neutral-900 border-neutral-800 shadow-xl">
            <CardContent className="p-3 md:p-6 space-y-4 md:space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClick}
                    className={`
                    relative flex items-center w-16 h-8 rounded-full 
                    transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
                    ${
                      isActive
                        ? 'bg-blue-500 focus:ring-blue-500'
                        : 'bg-gray-200 focus:ring-gray-500'
                    }
                  `}
                    aria-pressed={isActive}
                    title={
                      isActive
                        ? 'Desactivate the signature'
                        : 'Activate the signature'
                    }
                  >
                    <span
                      className={`
                      absolute flex items-center justify-center
                      w-6 h-6 rounded-full bg-white shadow-md
                      transition-transform duration-300 ease-in-out
                      ${isActive ? 'translate-x-9' : 'translate-x-1'}
                    `}
                    >
                      {isActive ? (
                        <AiFillSignature className="w-4 h-4 text-blue-500" />
                      ) : (
                        <AiOutlineSignature className="w-4 h-4 text-gray-400" />
                      )}
                    </span>
                  </button>
                  <span
                    className={`text-sm ${isActive ? 'text-blue-500' : 'text-gray-500'}`}
                  >
                    {isActive ? 'Signature activate' : 'Signature desactivate'}
                  </span>
                </div>

                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger className="w-[180px] text-white">
                    <SelectValue placeholder="Choose Style" />
                  </SelectTrigger>
                  <SelectContent className="text-white bg-black">
                    <SelectGroup>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="only-value">Only-Value</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <form onSubmit={handleSubmitButton} className="relative">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full bg-neutral-800 border-neutral-700 text-neutral-100 pr-12 focus:ring-2 focus:ring-blue-500 text-sm md:text-base py-2 md:py-3"
                  placeholder="Type your request..."
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 hover:scale-110 transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3 md:h-4 md:w-4" />
                  )}
                </Button>
              </form>
              <UploadFile
                fileInfo={fileInfo}
                setFileInfo={setFileInfo}
                setSelectedFile={setSelectedFile}
              />

              {currentResponse && (
                <Alert className="bg-neutral-800 border-neutral-700">
                  <AlertDescription className="text-xs md:text-sm text-neutral-200 font-mono whitespace-pre-wrap break-words leading-relaxed">
                    {showLoadingMessage
                      ? 'Processing...'
                      : parseAndDisplayWithShortLinks(currentResponse.text)}
                    {(currentResponse.isTyping || isLoading) && (
                      <span className="animate-pulse ml-1">▋</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StarknetAgent;
