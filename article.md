# MCP's in Snak

In this article, we will discuss what an MCP is and why they are crucial to our Snak project.

## Introduction

Imagine an autonomous agent that can interact with an infinite number of tools. This is not science fiction, but the reality we're building with Snak using Model Context Protocol(MCP).

## What is an MCP ?

The **Model Context Protocol** (MCP) is an open protocol that enables seamless integration between LLM applications like Snak and external data sources and tools. The MCP solves a critical problem: previously, AI Agents could only use tools that were specifically assigned to them. Now, thanks to the Model Context Protocol, tools created for specific purposes—such as our Starknet tools integration—can be utilized by any other agent that supports MCP, but it also means that Snak can also support every MCP tools integration. This represents a revolution in the world of AI Agents,
**eliminating closed environments and ushering in an era of unlimited interoperability**

## How does MCP work?

This is a brief explanation of how MCP works.
The MCP protocol is separated into three parts: the host, client, and server. The MCP Server is a program that exposes specific capabilities (tools) through the standardized Model Context Protocol. The MCP Host refers to programs like **Snak**, Claude Desktop, IDEs, or AI tools that want to access data through MCP. The MCP Client is a protocol client that maintains 1:1 connections with servers. If you want to learn more about how MCPs function, I recommend consulting the [official documentation](https://modelcontextprotocol.io/introduction).

## What is Snak

Snak is an Agent Engine powered by Starknet that allows you to create your own AI Agent (autonomous or interactive) with customizable configurations such as context definitions, plugins selection, and memory options (lifetime or short-term memory). Snak not only provides all the actions you need to interact with Starknet, but also supports integration with actions from any MCP-compatible server over the world. You can explore over 3,000 ready-to-use MCP servers on [MCP.so](https://mcp.so/).

## The role of MCPs in the Snak project

In our project, MCPs play a crucial role as they allow us to continuously enhance our agent's capabilities with an exponential number of tools thanks to the community. This also enables us to focus on the autonomous aspect of our agent, which is its most important feature. We thus offer you the possibility to launch multiple autonomous agents benefiting from intelligently managed memory, which will make their actions always relevant and aligned with the context and objectives you have assigned to them, while enjoying reduced costs.

As previously explained, Snak provides its own tools designed to interact with Starknet, and we will continue to develop new tools and improve existing ones. We also have our own MCP Server that allows you to implement all tools provided by Snak directly in your Claude Desktop and benefit from Claude's interface to interact with them. This is particularly interesting in a "chat-based" format, as you won't need an additional Anthropic key as would be the case for an agent on Snak. You can follow this [tutorial](https://docs.starkagent.ai/mcp_integration#implement-mcp-servers-in-snak) to implement it.

## How do the MCPs and Plugins integrations on Snak Work

### General architecture

Snak's architecture is divided into two distinct integration paths: a plugin system managed by the Snak-Plugins Manager, and a MCP system where Snak Mcp-Clients communicate with MCP servers.

![image](SnakMcpWorks.png)

**Core Components of Snak**

- **Snak-Tools Manager**: A module that maintains a unified registry of tools from both the Snak-Plugins Manager and Snak Mcp-Clients, utilizing the Langchain Tools Format for consistency.

- **Snak-Plugins Manager**: A module responsible for registering all plugins included in the agent configuration, along with their associated tools and descriptions.

- **Snak-Mcp-Clients**: A module that converts all tools from Mcp-Clients into the Langchain Tools Format, ensuring compatibility across the system.

- **Plugins**: A collection of available plugins for Snak, each containing their specific tools and functionalities.

- **MCP-Server**: Lightweight programs that each expose specific capabilities through the standardized Model Context Protocol.

## Conclusion

The integration of the Model Context Protocol (MCP) into Snak represents a significant advancement in the field of AI agents. By leveraging MCP's standardized approach to tool integration, Snak has overcome the traditional limitations of AI agent systems, where tools were restricted to specific platforms. This innovation allows Snak to offer flexibility and extensibility.


By embracing the open standards of MCP, we're building more than just another AI agent - we're contributing to a new paradigm of interoperable, extensible AI systems that can truly deliver on the promise of unlimited tool integration, fully customizable agents, and autonomous intelligence.

