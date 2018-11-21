```
LIP: lip-maciejbaj-versioning_scheme
Title: Use a consistent and informative versioning scheme
Authors: Maciej Baj <maciej@lightcurve.io>
Status: Draft
Type: Informational
Module: -
Created: 2018-09-14
Updated: 2018-11-21
```

## Abstract

This LIP proposes a versioning system for Lisk Core aimed at better reflecting the ongoing changes to the Lisk software implementation and its underlying blockchain protocol. One which makes the clear distinction between software implementation and blockchain protocol changes.

The changes to the Lisk software implementation are reflected through a semantic versioning scheme (https://semver.org/), relying on a 3 digit notation **(MAJOR.MINOR.PATCH)** to indicate major, minor and patch level changes.

The changes to the Lisk blockchain protocol are additionally reflected using a 2 digit notation **(H.S)** to indicate chain and network compatibility, and whether the release will introduce a hard or soft fork event.

## Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

The versioning scheme currently in place (semver) reliably communicates Lisk software implementation changes, for example:

- Changes to the public API endpoints, requests and responses
- Changes to the configuration schema and format
- Changes to the logging system, levels and events

However, by using this versioning scheme alone, there is no logical capacity provided for communicating changes to the Lisk blockchain protocol except insofar as they result in changes to the implementation. That is, there is no separation of concerns between protocol changes and implementation changes in the current versioning scheme. Examples of protocol-level changes include:

- Changes to the consensus rules
- Changes to the blocks schema
- Changes to existing transaction types
- New transaction types
- Changes to the P2P API

 Depending on the nature of the changes to the Lisk blockchain protocol, they can result in either a hard or soft fork event.  Changes to the P2P layer are communicated as hard forks if they are breaking the synchronization with nodes staying on the old version.

If the type of a release (software and protocol change) is not clearly communicated, delegates and node operators are not reliably informed of the consequences of deploying a proposed release.

## Rationale

Through independent communication of major (breaking), minor (feature) or patch (bug fix) level changes in the Lisk software implementation, delegate and node operators are reliably informed when a new release will require an update to their own reliant applications and services. 

Through independent communication of fork events (hard or soft), delegates and node operators are reliably informed when a new release will require a consensus to accord with the proposed change to the Lisk blockchain protocol.

The result being delegates and node operators are always given the correct information needed to assess the change impact behind each new release.

## Specification

### A. Protocol Versioning

The protocol version will be denoted by two digits, **H.S**. The first digit, **H**, depends on the number of hard forks. More precisely, **H** is incremented with every hard fork. **S** represents the number of soft forks since the last hard fork.  We define the initial protocol version 1.0 to be the one that was implemented by Lisk Core 1.0.0.

#### Examples

Consider the scenario where the current protocol version equals 1.3.

##### Hard Fork

In the event of a hard fork, **H** is incremented by **1** and **S** set to **0**. Hence, the protocol version will be **2.0**.

##### Soft Fork

In the event of a soft fork, **S** is incremented by **1**. Hence, the protocol version will be **1.4**.

### B. Software Implementation Versioning

Any Lisk Core software changes, except for the logging system, are communicated following the exact rules specified by Semver (https://semver.org/).

Software versioning still follows a 3 digit notation **(MAJOR.MINOR.PATCH)**, where the individual digits represent the following types of software changes:

```
MAJOR - Breaking change
MINOR - New feature
PATCH - Bug fix
```

For example, changes to:

- Public API endpoints, requests and responses
- Configuration schema, databases schema and format

Are communicated according to Semver rules.

Changes to the Lisk Core logging system and its levels are communicated as breaking (**MAJOR**) only when affecting logs on levels `warning`, `error` or `fatal`. How a particular change to the logs affect the release notation should be clarified by the examples below:

- Any change to the logs error level is considered as **MAJOR**

```js
- logger.error(`Blockchain failed at height: ${err.block.height}`);
+ logger.error(`Blockchain failed on round: ${err.round}`);
```

- Any change to the logs debug level is considered as **MINOR**

```js
- logger.debug('Processing block', block.id);
+ logger.debug('Processing block of id', block.id);
```

- Any logs patching change is considered as **PATCH**

```js
- logger.error(`Blockchain failed at height: ${err.nonExistantKey.height}`);
+ logger.error(`Blockchain failed at height: ${err.block.height}`);
```

### Implementation

In the handshake process, the `"minVersion"` field is currently used to determine compatibility between two nodes. The `"minVersion"` version field will have to be replaced by the `“protocolVersion”` field and reused to determine compatibility in the handshake process.
To satisfy the new versioning requirements, a new field needs to be introduced in package.json, namely `"protocolVersion"`:

```js
{
   "version": "1.3.0",
   ...
   "lisk": {
     "protocolVersion": "1.0",
   }
}
```

The `“protocolVersion”` field will also have to be added as a node's header and broadcast to other peers:


```js
if (!system.versionCompatible(headers.protocolVersion)) {
  return setImmediate(
     cb,
     {
        code: failureCodes.PROTOCOL_VERSION,
        description: `Expected protocol: ${system.protocolVersion} but received: ${
           headers.protocolVersion
        }`,
     },
     peer
  );
}
```

## Backwards Compatibility

The introduction of a new Lisk versioning system will be fully backwards compatible. Both the Lisk blockchain protocol and Lisk Core software parts of the new versioning system will be compatible with current versions. For instance, if the proposed LIP would have been included into a Lisk Core 1.4.0 release, its version would have to be extended to Lisk Core version 1.4.0, protocol version 1.0. Both `"version"` and `"protocolVersion"` headers will be broadcasted to other nodes. The nodes with older software will reuse the `"version"` header, whereas the the nodes with newer software will use the `"protocolVersion"` header to determine compatibility. The end result will remain the same, therefore the compatibility is not affected.
