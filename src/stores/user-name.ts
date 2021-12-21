import { aes, rsa } from 'cs-crypto'
import { getUserID } from '$lib/session'
import { Readable, writable } from 'svelte/store'
import { HTTPerror, DisplayNames, Visibilities } from '$lib'
import { route } from '$lib'
import { mustGetByKey, addToStore, getByKey, updateWithKey } from '$db'

function create(): Readable<Name> & SingleResourceStore<NameData> {
  let initialized = false
  const initialState: Name = {
    id: '',
    firstName: '',
    lastName: '',
    username: '',
    displayName: DisplayNames.Anonymous,
    visibility: {
      firstName: Visibilities.Encrypted,
      lastName: Visibilities.Encrypted
    },
    checksum: ''
  }
  const { subscribe, set }  = writable(initialState)

  return {
    subscribe,
    async init() {
      if (initialized) {
        return
      }

      const userID = getUserID()
      const res = await fetch(route('/name'), {
        method: 'GET',
        headers: {
          'CSRF-Token': localStorage.getItem('CSRF-Token')!
        }
      })
      if (res.status === 204) {
        initialized = true
        return
      }
      if (res.status !== 200) {
        throw new Error(await HTTPerror(res, 'failed to retrieve name from server'))
      }

      const document: NameDocument = await res.json()
      const cached: Name|undefined = await getByKey('user-name', userID)
      if (cached != null && cached.checksum === document.meta.checksum) {
        set(cached)
        return
      }
    
      const visibility = document.visibility

      const decryptFirstName = visibility.firstName === Visibilities.Encrypted
      const decryptLastName = visibility.lastName === Visibilities.Encrypted
      const hasEncryptedFields = decryptFirstName || decryptLastName || document.privateDisplayName != null
      // Decrypt the cryptokey if needed
      let cryptoKey: CryptoKey|undefined
      if (hasEncryptedFields && document.meta.cryptoKey !== undefined) {
        const { privateKey } = await mustGetByKey<MasterKeys>('keys', userID)
        cryptoKey = await rsa.unwrapKey(document.meta.cryptoKey, privateKey, 'AES-GCM')
      }

      // Decrypt necessary fields
      const firstName = decryptFirstName ? await aes.decrypt(document.firstName, cryptoKey!) : document.firstName
      const lastName = decryptLastName ? await aes.decrypt(document.lastName, cryptoKey!) : document.lastName
      let namePreference: DisplayNames|undefined
      if (document.privateDisplayName != null) {
        namePreference = parseInt(await aes.decrypt(document.privateDisplayName, cryptoKey!))
      }

      // Update local state
      const final: Name = {
        id: userID,
        firstName,
        lastName,
        username: document.username,
        visibility,
        privateDisplayName: namePreference,
        displayName: document.displayName,
        cryptoKey,
        checksum: document.meta.checksum
      }
      set(final)
      await updateWithKey('user-name', final)
      initialized = true
    },
    async create(name: NameData): Promise<void> {
      // Validate the name
      if (typeof name !== 'object') {
        throw new TypeError(`Expected type object, received type ${typeof name}`)
      }
      // Get the user's ID
      const userID = getUserID()

      // Generate a key if there are any fields that need to be encrypted
      const visibility = name.visibility
      const encryptFirstName = visibility.firstName === Visibilities.Encrypted
      const encryptLastName = visibility.lastName === Visibilities.Encrypted
      const hasEncryptedFields = encryptFirstName || encryptLastName || name.privateDisplayName != null
      let cryptoKey: CryptoKey|undefined
      if (hasEncryptedFields) {
        cryptoKey = await aes.generateKey('AES-GCM')
      } 
      // Encrypt any necessary fields
      const firstName = encryptFirstName ? await aes.encrypt(name.firstName, cryptoKey!) : name.firstName
      const lastName = encryptLastName ? await aes.encrypt(name.lastName, cryptoKey!) : name.lastName
      let namePreference: string|undefined
      if (name.privateDisplayName != null){
        namePreference = await aes.encrypt(name.privateDisplayName.toString(), cryptoKey!)
      }

      // Encrypt the cryptokey
      let encryptedKey: string|undefined
      if (cryptoKey != null) {
        const { publicKey } = await mustGetByKey<MasterKeys>('keys', userID)
        encryptedKey = await rsa.wrapKey(cryptoKey!, publicKey)
      }

      // Submit the document to the API
      const document: NameDocument<NameMetaRequest> = {
        firstName,
        lastName,
        username: name.username,
        privateDisplayName: namePreference,
        displayName: name.displayName,
        visibility,
        meta: {
          cryptoKey: encryptedKey
        }
      }
      const res = await fetch(route('/name'), {
        method: 'PATCH',
        headers: {
          'CSRF-Token': localStorage.getItem('CSRF-Token')!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(document)
      })
      if (res.status !== 200) {
        throw new Error(await HTTPerror(res, 'failed to submit name to server'))
      }

      // Update local state and IDB
      const { meta }: MetaResponse = await res.json()
      const final: Name = {
        ...name,
        id: userID,
        checksum: meta.checksum,
        cryptoKey
      }
      set(final)
      await addToStore('user-name', final)
      initialized = true
    },
    async delete(): Promise<void> {
      const res = await fetch(route('/name'), {
        method: 'DELETE',
        headers: {
          'CSRF-Token': localStorage.getItem('CSRF-Token')!
        }
      })
      if (res.status !== 204) {
        throw new Error(await HTTPerror(res, 'failed to delete name from server'))
      }
    }
  }
}

export const userName = create()

export default userName