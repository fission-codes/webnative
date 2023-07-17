import * as AgentDID from "../../../agent/did.js"
import * as Ucan from "../../../ucan/index.js"
import * as Fission from "./fission/index.js"

import { CID } from "../../../common/index.js"
import { Agent, DNS, Manners } from "../../../components.js"
import { FileSystem } from "../../../fs/class.js"
import { DELEGATE_ALL_PROOFS } from "../../../ucan/capabilities.js"
import { listFacts } from "../../../ucan/chain.js"
import { rootIssuer } from "../../../ucan/lookup.js"
import { Implementation } from "../implementation.js"

////////
// 🧩 //
////////

export type Annex = {
  requestVerificationCode: (
    formValues: Record<string, string>
  ) => Promise<{ ok: true } | { ok: false; reason: string }>
}

export async function requestVerificationCode(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
  formValues: Record<string, string>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let email = formValues.email

  if (!email)
    return {
      ok: false,
      reason: `Email is missing from the form values record. It has the following keys: ${Object.keys(
        formValues
      ).join(", ")}.`,
    }

  email = email.trim()

  const rawtoken = await Ucan.build({
    audience: await Fission.did(endpoints, dependencies.dns),
    issuer: await Ucan.keyPair(dependencies.agent),
    capabilities: [DELEGATE_ALL_PROOFS],
    facts: [{ placeholder: "none" }], // For rs-ucan compat (obsolete, but req'd for 0.2.x)
    proofs: [], // rs-ucan compat
  })

  const token = Ucan.encode(rawtoken)

  formValues.did = await dependencies.agent.did()

  const response = await fetch(
    Fission.apiUrl(endpoints, "/auth/email/verify"),
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(formValues),
    }
  )

  // The server
  return response.ok
    ? { ok: true }
    : { ok: false, reason: `Server error: ${response.statusText}` }
}

export type Dependencies = {
  agent: Agent.Implementation
  dns: DNS.Implementation
  manners: Manners.Implementation<FileSystem>
}

//////////////
// CREATION //
//////////////

export async function canRegister(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
  formValues: Record<string, string>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let username = formValues.username

  if (!username) {
    return {
      ok: false,
      reason: `Username is missing from the form values record. It has the following keys: ${
        Object.keys(formValues).join(", ")
      }.`,
    }
  }

  username = username.trim()

  if (Fission.isUsernameValid(username) === false) {
    return {
      ok: false,
      reason: "Username is not valid.",
    }
  }

  if (await Fission.isUsernameAvailable(endpoints, dependencies.dns, username) === false) {
    return {
      ok: false,
      reason: "Username is not available.",
    }
  }

  return {
    ok: true,
  }
}

export async function register(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
  formValues: Record<string, string>,
  identifierUcan: Ucan.Ucan,
): Promise<
  { ok: true; ucans: Ucan.Ucan[] } | { ok: false; reason: string }
> {
  let username = formValues.username

  if (!username) {
    return {
      ok: false,
      reason: `Username is missing from the form values record. It has the following keys: ${
        Object.keys(formValues).join(", ")
      }.`,
    }
  }

  const token = Ucan.encode(
    await Ucan.build({
      audience: await Fission.did(endpoints, dependencies.dns),
      issuer: await Ucan.keyPair(dependencies.agent),

      proofs: [Ucan.encode(identifierUcan)],
    })
  )

  const response = await fetch(Fission.apiUrl(endpoints, "/user"), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(formValues),
  })

  if (response.status < 300) {
    return {
      ok: true,
      ucans: [
        // TODO: This should be done by the server
        await Ucan.build({
          audience: identifierUcan.payload.iss,
          issuer: await Ucan.keyPair(dependencies.agent),
          proofs: [Ucan.encode(identifierUcan)],

          facts: [{ username }],
        }),
      ],
      // TODO: We need some UCANs here. We should get capabilities from the Fission server.
    }
  }

  return {
    ok: false,
    reason: `Server error: ${response.statusText}`,
  }
}

///////////////
// DATA ROOT //
///////////////

export async function canUpdateDataRoot(
  identifierUcans: Ucan.Ucan[],
  ucanDictionary: Ucan.Dictionary,
): Promise<boolean> {
  const facts = identifierUcans.map(
    ucan => listFacts(ucan, ucanDictionary),
  )

  // TODO: Check if we have the capability to update the data root.
  //       Or in the case of the old Fission server, any account UCAN.
  return facts.some(f => !!f["username"])
}

export async function lookupDataRoot(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
  identifierUcans: Ucan.Ucan[],
  ucanDictionary: Ucan.Dictionary,
): Promise<CID | null> {
  const facts = identifierUcans.reduce(
    (acc: Record<string, unknown>, ucan) => ({ ...acc, ...listFacts(ucan, ucanDictionary) }),
    {},
  )

  const username = facts["username"]
  if (!username) {
    throw new Error(
      "Expected a username to be found in the facts of the delegation chains of the given identifier UCANs",
    )
  }
  if (typeof username !== "string") throw new Error("Expected username to be a string, but it isn't.")

  return Fission.dataRoot.lookup(
    endpoints,
    dependencies,
    username,
  )
}

export async function updateDataRoot(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
  dataRoot: CID,
  proofs: Ucan.Ucan[],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ucan = await Ucan.build({
    // Delegate to self
    audience: await AgentDID.signing(dependencies.agent),
    issuer: await Ucan.keyPair(dependencies.agent),

    capabilities: [DELEGATE_ALL_PROOFS],
    proofs: await Promise.all(
      proofs.map(prf => Ucan.cid(prf).then(c => c.toString())),
    ),
  })

  return Fission.dataRoot.update(
    endpoints,
    dependencies,
    dataRoot,
    ucan,
  )
}

///////////
// UCANS //
///////////

export async function did(identifierUcans: Ucan.Ucan[], ucanDictionary: Ucan.Dictionary): Promise<string> {
  const rootIssuers: Set<string> = identifierUcans.reduce(
    (set: Set<string>, identifierUcan): Set<string> => {
      const iss = rootIssuer(identifierUcan, ucanDictionary)
      return set.add(iss)
    },
    new Set() as Set<string>,
  )

  if (rootIssuers.size > 1) {
    console.warn(
      "Encounter more than one root issuer in the identifier UCANs set. This should ideally not happen. Using the first one in the set.",
    )
  }

  const root = Array.from(rootIssuers.values())[0]
  if (!root) throw new Error("Expected a root issuer to be found")
  return root
}

////////
// 🛳 //
////////

export function implementation(
  endpoints: Fission.Endpoints,
  dependencies: Dependencies,
): Implementation<Annex> {
  return {
    annex: {
      requestVerificationCode: (...args) =>
        requestVerificationCode(endpoints, dependencies, ...args),
    },

    canRegister: (...args) => canRegister(endpoints, dependencies, ...args),
    register: (...args) => register(endpoints, dependencies, ...args),

    canUpdateDataRoot: (...args) => canUpdateDataRoot(...args),
    lookupDataRoot: (...args) => lookupDataRoot(endpoints, dependencies, ...args),
    updateDataRoot: (...args) => updateDataRoot(endpoints, dependencies, ...args),

    did,
  }
}
