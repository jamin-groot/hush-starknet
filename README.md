# Hush — Privacy-First Payments on Starknet

Hush is a privacy-first payment hub built on Starknet that enables users to send encrypted payments, attach private transaction notes, and prepare for advanced shielded payment flows using zero-knowledge infrastructure.

Unlike traditional wallets that expose transaction metadata, Hush introduces privacy-native payment experiences while preserving Starknet’s scalability and composability.

---

## 🚀 Problem

Blockchain payments are transparent by default:

• Transaction notes are public
• Payment intent can be exposed
• Sender-receiver relationships are traceable
• Privacy tooling is fragmented and complex

This creates friction for everyday payments, invoices, and merchant interactions.

---

## 💡 Solution

Hush provides a privacy-first payment layer that combines wallet functionality with encrypted metadata and upcoming shielded payment primitives.

Users can:

• Send STRK payments securely
• Attach encrypted transaction notes
• Track lifecycle-aware transactions
• Prepare for stealth and shielded payment flows

---

## ✨ Features

### Wallet Core

• Starknet wallet connection (Argent + Braavos)
• STRK balance indexing with RPC fallback
• Transaction lifecycle state machine
• Confirmation polling and success modal

### Privacy Layer (MVP)

• Encrypted transaction notes
• Shared key derivation for sender/receiver
• Privacy toggle UX
• Metadata privacy without breaking transfer execution

### Infrastructure

• Multi-RPC resilience
• Uint256 safe transfer engine
• Lifecycle-aware transfer orchestration
• Balance auto-refresh after confirmation

---

## 🧠 Architecture Overview

Hush is structured in layered phases:

**Wallet Layer**
• Connection
• Balance indexing
• Transfer execution
• Lifecycle state tracking

**Privacy Layer**
• Encrypted notes (MVP)
• Receiver note discovery (upcoming)
• Stealth payments (planned)

**Protocol Layer**
• Shielded pool contracts
• Nullifier logic
• Commitment trees
• zk proof verification

---

## 🛠 Tech Stack

• Starknet
• Next.js App Router
• starknet-react
• Zustand state management
• AES-GCM encryption (client-side)
• Multi-RPC provider architecture
• TypeScript

---

## 🧪 Demo Flow

1. Connect wallet
2. View STRK balance
3. Send payment
4. Enable Privacy Mode
5. Attach encrypted transaction note
6. Confirm lifecycle completion

---

## 🔮 Roadmap

• Transaction history indexing
• Receiver encrypted note scanning
• Stealth payment protocol
• Shielded payment pool (Cairo)
• zk proof integration
• Merchant privacy payments
• Relayer infrastructure

---

## 🏁 Hackathon Context

Hush is built as a privacy-native payment hub for Starknet, combining wallet UX with cryptographic privacy primitives to enable real-world private payment experiences.

---

## 📌 Status

MVP in active development with encrypted metadata privacy and lifecycle-aware STRK transfers completed.

---

## 📄 License

MIT

