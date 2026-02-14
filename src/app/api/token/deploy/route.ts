import { NextRequest, NextResponse } from 'next/server';
import { saveToken, getToken, updateToken } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, name, symbol, supply, privateKey } = body;

        if (!projectId || !name || !symbol || !supply) {
            return NextResponse.json(
                { error: 'projectId, name, symbol, and supply are required' },
                { status: 400 }
            );
        }

        // Save token with pending status
        const token = saveToken({
            projectId,
            name,
            symbol,
            supply,
            network: 'Base Sepolia',
            status: 'pending',
        });

        // If private key is provided, attempt deployment
        if (privateKey) {
            try {
                // Dynamic import to avoid issues if ethers is not installed
                const { ethers } = await import('ethers');

                // Simple ERC-20 contract
                const ERC20_ABI = [
                    'constructor(string name, string symbol, uint256 initialSupply)',
                    'function name() view returns (string)',
                    'function symbol() view returns (string)',
                    'function totalSupply() view returns (uint256)',
                    'function balanceOf(address) view returns (uint256)',
                    'function transfer(address to, uint256 amount) returns (bool)',
                    'function approve(address spender, uint256 amount) returns (bool)',
                    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
                ];

                // Minimal ERC-20 bytecode (OpenZeppelin-based)
                const ERC20_BYTECODE = '0x60806040523480156200001157600080fd5b5060405162000c7838038062000c78833981016040819052620000349162000230565b8251839083906200004d906003906020860190620000d5565b50805162000063906004906020840190620000d5565b5050506200009233620000816200009960201b60201c565b6200008d9190620002dc565b620000a2565b50620003a4565b60006012905090565b6001600160a01b038216620000fd5760405163ec442f0560e01b8152600060048201526024015b60405180910390fd5b6200010b60008383620001c4565b5050565b634e487b7160e01b600052604160045260246000fd5b600082601f8301126200013757600080fd5b81516001600160401b03808211156200015457620001546200010f565b604051601f8301601f19908116603f011681019082821181831017156200017f576200017f6200010f565b816040528381526020925086838588010111156200019c57600080fd5b600091505b83821015620001c05785820183015181830184015290820190620001a1565b6000938101909301929092525090505092915050565b6001600160a01b038316620001f3578060026000828254620001f89190620002dc565b90915550620002679050565b6001600160a01b038316600090815260208190526040902054818110156200024857604051630c3b823560e01b81526001600160a01b03851660048201526024810182905260448101839052606401620000f4565b6001600160a01b03841660009081526020819052604090209082900390555b6001600160a01b03821662000286576002805482900390556200029f565b6001600160a01b0382166000908152602081905260409020805482019055620002a5565b505b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620002c991815260200190565b60405180910390a3505050565b505b92915050565b8082018082111562000002576200000262000306565b634e487b7160e01b600052601160045260246000fd5b6108648062000414600039600090565b600080600060608486031262000333576000908190fd5b83516001600160401b03808211156200034b576000908190fd5b620003598783880162000125565b945060208601519150808211156200037057600080fd5b506200037f8682870162000125565b925050604084015190509250925092565b610864806200041460003960006000f3fe';

                const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
                const wallet = new ethers.Wallet(privateKey, provider);

                const factory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, wallet);
                const supplyWei = ethers.parseUnits(supply, 18);
                const contract = await factory.deploy(name, symbol, supplyWei);
                const receipt = await contract.deploymentTransaction()?.wait();

                const contractAddress = await contract.getAddress();

                updateToken(token.id, {
                    contractAddress,
                    txHash: receipt?.hash,
                    status: 'deployed',
                    deployedAt: new Date().toISOString(),
                });

                return NextResponse.json({
                    ...token,
                    contractAddress,
                    txHash: receipt?.hash,
                    status: 'deployed',
                    deployedAt: new Date().toISOString(),
                }, { status: 201 });
            } catch (deployError) {
                console.error('Token deployment error:', deployError);
                updateToken(token.id, { status: 'failed' });
                return NextResponse.json({
                    ...token,
                    status: 'failed',
                    error: String(deployError),
                }, { status: 200 });
            }
        }

        // Return pending token if no private key
        return NextResponse.json(token, { status: 201 });
    } catch (error) {
        console.error('Error deploying token:', error);
        return NextResponse.json({ error: 'Failed to deploy token' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const projectId = request.nextUrl.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }
        const token = getToken(projectId);
        return NextResponse.json(token || null);
    } catch (error) {
        console.error('Error fetching token:', error);
        return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
    }
}
