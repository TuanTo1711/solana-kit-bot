import { getCreateAccountInstruction } from '@solana-program/system'
import {
  AuthorityType,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
  getInitializeMintInstruction,
  getMintToInstruction,
  getSetAuthorityInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Instruction,
  type TransactionSigner
} from '@solana/kit'
import { getCreateMetadataAccountV3Instruction, TOKEN_METADATA_PROGRAM_ADDRESS } from '~/generated'

type CreateMintParams = {
  name: string
  symbol: string
  uri: string
  supply: bigint
  decimals: number
  payer: TransactionSigner<string>
  revokeMintAuthority?: boolean
  revokeFreezeAuthority?: boolean
}

export async function createMint(params: CreateMintParams): Promise<Instruction[]> {
  const { payer, decimals, revokeMintAuthority, revokeFreezeAuthority, supply, name, symbol, uri } =
    params
  const instructions: Instruction[] = []
  const mint = await generateKeyPairSigner()

  const createAccountIx = getCreateAccountInstruction({
    payer,
    newAccount: mint,
    space: 82,
    lamports: 1461600,
    programAddress: TOKEN_PROGRAM_ADDRESS,
  })
  instructions.push(createAccountIx)

  const initializeMintIx = getInitializeMintInstruction({
    mint: mint.address,
    decimals,
    mintAuthority: payer.address,
    freezeAuthority: payer.address,
  })
  instructions.push(initializeMintIx)

  const [ata] = await findAssociatedTokenPda({
    owner: payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: mint.address,
  })

  const createAtaIx = getCreateAssociatedTokenInstruction({
    ata,
    mint: mint.address,
    owner: payer.address,
    payer: payer,
  })
  instructions.push(createAtaIx)

  const mintTo = getMintToInstruction({
    mint: mint.address,
    amount: supply,
    token: ata,
    mintAuthority: payer.address,
  })
  instructions.push(mintTo)

  const encoder = getAddressEncoder()
  const [metadata] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ADDRESS,
    seeds: [
      Buffer.from('metadata'),
      encoder.encode(TOKEN_METADATA_PROGRAM_ADDRESS),
      encoder.encode(mint.address),
    ],
  })

  const createMetadataIx = getCreateMetadataAccountV3Instruction({
    mint: mint.address,
    mintAuthority: payer,
    payer,
    updateAuthority: payer,
    isMutable: false,
    collectionDetails: null,
    metadata,
    data: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: 0,
      collection: null,
      creators: null,
      uses: null,
    },
  })
  instructions.push(createMetadataIx)

  if (revokeMintAuthority) {
    const revokeMintAuthorityIx = getSetAuthorityInstruction({
      authorityType: AuthorityType.MintTokens,
      newAuthority: null,
      owner: payer.address,
      owned: mint.address,
    })
    instructions.push(revokeMintAuthorityIx)
  }

  if (revokeFreezeAuthority) {
    const revokeFreezeAuthorityIx = getSetAuthorityInstruction({
      authorityType: AuthorityType.FreezeAccount,
      newAuthority: null,
      owner: payer.address,
      owned: mint.address,
    })
    instructions.push(revokeFreezeAuthorityIx)
  }

  return instructions
}
