```
LIP: lip-janhack-p2p
Title: Introduce robust peer selection and banning mechanism
Author: Jan Hackfeld, jan.hackfeld@lightcurve.io
Type: Standards Track
Module: Peers
Created: -
Updated: -
```

## Abstract

This LIP proposes a new implementation of the P2P layer of Lisk introducing a robust peer selection with periodic shuffling and banning mechanism. We further suggest to refine the gossip-based flooding mechanism for blocks, transactions and signatures in order to improve information propagation. Together the proposed changes make the Lisk peer-to-peer network ready to scale to a large number of nodes and further increase the robustness of the network.

## Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html "GNU General Public License, version 3").

## Motivation

In the current implementation of the P2P layer of Lisk, every peer maintains an open websocket connection to every other peer. Blocks, transaction bundles and signature bundles are pushed to a random subset of the peers with a relay limit of 3 bounding the number of hops that blocks, transactions or signatures are forwarded. Moreover, already received blocks are not forwarded again. The current gossip-based solution is robust against attackers, as it is not possible to predict how a block, transaction or signature propagates through the network and the information is pushed to a large number of peers. However, the approach is not scalable, as a large number of open connections creates a big overhead for every peer so that at some point it will become infeasible to maintain an open connection to every other node. Because of the use of a fixed relay limit, the current implementation also does not scale automatically and network delays can greatly impact the block propagation.

The proposal for a new implementation of the P2P layer addresses all of these issues. It makes the Lisk P2P layer ready to handle a large number of peers while maintaining a robust gossip-based protocol. Peers establish connections semi-randomly and new information such as blocks,
transaction bundles and signature bundles are flooded across the network refining the current gossip mechanism. This should, in particular, improve block propagation meaning that the number of missed blocks for peers is significantly reduced. Furthermore, the proposed banning mechanism greatly improves the resilience of the network against denial-of-service attacks, which is very important in a DPoS system with a fixed block time like Lisk.

## Rationale

In this section, we justify each of the suggested changes of the P2P module in Lisk in one of the following subsections.

### Unstructured P2P network

Currently, every Lisk node tries to connect to every other node so that the overlay network resembles a fully connected network. In order to enable the scalability to a large network size, every node in the proposed peer-to-peer layer only connects to a subset of the nodes. For such a network, one distinguishes between structured and unstructured P2P networks depending on whether the overlay network has a structured topology or not. Structured P2P networks are typically used to efficiently search and route information that is not present at every node. In the case of Lisk, all nodes store a complete copy of the blockchain so that the additional complexity introduced by a structured P2P network is not necessary. [Recent research](http://www.cs.bu.edu/~goldbe/projects/eclipseEth) has also shown that the use of structured P2P networks can introduce additional security risks because the structure can be exploited by an attacker. We therefore favor an unstructured P2P protocol, as used in Bitcoin for instance.

### Eager and lazy push mechanism

Another distinction in P2P networks is between an eager and lazy push mechanisms. In our current system we adopt an eager push mechanism: new information like blocks are directly pushed to a subset of the peers. In Bitcoin, on the other hand, a new block is only announced to the peers by sending the block hash or header. If a peer learns about a new announced block, it then has to explicitly request the full block from a peer. This mechanism of first sending only the message identifier and not the full payload is referred to as lazy push. For the case of Lisk, blocks are relatively small (e.g. compared to Bitcoin) and the block time of 10 s is short, therefore, fast propagation is essential. In order to save bandwidth while maintaining a fast propagation of information in the network, we propose a hybrid approach, as adopted in Ethereum for instance. This means that a node uses eager push for a small number of the connected peers and lazy push for the majority of the connected peers. This means that a complete block is sent to a small number of connected peers and the block hash to all other connected peers.

### Peer discovery

As every peer will be only connected to a subset of all the peers in the network, it is important to have a good peer discovery and selection mechanism. Otherwise, it could be possible that a peer only connects to peers controlled by an attacker (eclipse attack). In particular, it will be necessary to distinguish between outgoing connections (initiated by the node itself) and incoming connections (initiated by other peers). It is crucial to always have a sufficient number of outgoing connections that can be trusted as they were established according to the peers’ own selection mechanism. Our suggested peer discovery mechanism is based on Bitcoins peer discovery, which is an established solution that has been proven to be robust in practice.

### Connections

Below we give a high level description of the basic mechanism regarding incoming and outgoing connections, details are then given in the section ‘’Specification’’. The default choice of parameters will be further refined via testing.

- Every peer makes 20 outgoing connections to randomly chosen peers from its list of known peers.
- If an outgoing connection is closed by the other peer, a different peer is randomly selected as replacement.
- Every peer accepts up to 100 incoming connections from other peers, which are distinct from the outgoing peers.

### Periodic shuffling

In the P2P protocol of Bitcoin, the outgoing connections are initially chosen randomly, but then are maintained unless a connection is dropped by the other peer or a blacklist condition is met. This means that after the initial random choices of connections the network remains static if no peers enter or leave the network. Thus, over time an attacker can learn about the topology of the network and identify nodes to attack to disrupt the network. This is a much larger danger in DPoS networks with fixed block times as it’s always the same delegate node which will forge a block in its slot. We therefore suggest to periodically shuffle the outgoing connections, i.e. drop some of the outgoing connections and establish a new outgoing connection to a randomly chosen peer.

### Banning mechanism

In order to make the network more robust against denial-of-service attacks, we propose to adopt a banning mechanism to sanction peers that misbehave and send invalid information. It is crucial to ensure that the banning mechanism cannot be abused by an attacker to split the network as honest peers are banned. We rely on websockets/TCP to prevent IP spoofing so that we have the guarantee that the received messages was actually send by the specific peer. Most importantly, we only punish peers for sending messages that should not be relayed. So any message that an honest peer could forward should not lead to any punishment.

### Block propagation

Currently, a block is pushed to 25 randomly selected peers with a relay limit of 3. Moreover, already received blocks are not broadcast again. We propose to abandon the relay limit and forwarding every valid block that has not been received already. This makes the propagation less dependent on network delays and allows to decrease the number of peers that a block is send to. The choice of parameters for block propagation will we further refined via testing. On a high level, the proposed block propagation works as follows:

- A received block is first validated. If it is valid and has not been received it is forwarded.
- The block is forwarded to 16 randomly chosen connected peers of which at least 8 blocks are forwarded via outgoing connections.
- The block hash is announced to all other connected peers.

### Transaction propagation

Currently, in regular intervals of 5 seconds a bundle of unconfirmed transactions is pushed to 100 randomly chosen peers (eager push). As unconfirmed transactions are not as time critical as blocks, we propose to switch to a lazy push mechanism to broadcast transaction. This means at regular intervals the transactions selected by the transaction pool mechanism of a node will be announced to all connected peers by sending a list of transaction IDs. The peers can then request the full transactions explicitly from the Lisk node.

### Signature propagation

The current mechanism for the propagation of signature object is the same as for transactions, i.e. every 5 seconds a bundle of signature objects is broadcast to 100 randomly chosen peers using an eager push mechanism. As signature objects are relatively small, using lazy push would save little bandwidth in this case. Moreover, the mechanism of signing multisignature transaction will likely be changed in the future. That is why we suggest to stay with the current eager push mechanism for signature objects in this proposal.

## Specification

### Overview of message types and purpose

The following table gives an overview of the messages used in the proposed peer-to-peer protocol together with their type and a short description of their purpose. Most messages already exist in the current protocol (possibly with a different name). Messages from the current protocol not listed below are obsolete. More details regarding the new messages and some small modifications of existing messages will be given in the following sections.

| **Message Name**               | **Current Name**  | **Type** | **Description**                                                                                           |
| ------------------------------ | ----------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `postBlockAnnouncement`        | -                 | Event    | sends broadhash, height, last block ID                                                                    |
| `postBlock`                    | `postBlock`       | Event    | sends new block                                                                                           |
| `postSignatures`               | `postSignatures`  | Event    | send list of signature objects for multisignature transactions in the network                             |
| `postTransactionsAnnouncement` | -                 | Event    | send list of transaction IDs (lazy push)                                                                  |
| `getSystemInfo`                | `status`          | RPC      | get system information after connection initialization                                                    |
| `getPeers`                     | -                 | RPC      | get list of IP addresses and port number of peers                                                         |
| `getBlocksCommon`              | `blocksCommon`    | RPC      | for a list of block IDs returns success with a block if the most recent block id exists in the blockchain |
| `getBlocks`                    | `blocks`          | RPC      | get a list of blocks that were specified by a block ID and a limit on the number of subsequent blocks     |
| `getTransactions`              | `getTransactions` | RPC      | get a list of transactions that were specified by IDs                                                     |
| `getSignatures`                | `getSignatures`   | RPC      | get list of signature objects for multisignature transaction from a peer                                  |

### Data structures to manage peers

A Lisk node maintains in-memory data structures for efficiently managing peer related information such as IP addresses. The concrete implementation such as a dictionary or list of peer objects can be decided at implementation time and we therefore refer to the data structure abstractly as collection. In this section, we describe all operations that need to be supported by the data structure.

There is a collection `triedPeers` containing peers to which there is or has been a successful outgoing connection. Moreover, a collection `newPeers` containing IP addresses of peers that were advertised or to which there only has been an incoming connection. At regular intervals the `triedPeers` collection is persistently written to a file or a PostgreSQL table so that it is available after a restart of the node. Any IP address appears at most once in the collection `triedPeers` and `newPeers`.

To each IP address in the `triedPeers` collection, we associate a bucket b contained in {0,1,..., 63}. The bucket is computed from the IP address and a random secret of the node as follows:

```
group = /16 IPv4 prefix of peer’s IP address
k = Hash(random_secret, IP) % 4
b = Hash(random_secret, group, k) % 64
```

Note that in the case of IPv6 the group prefix is computed similarly, see the [Bitcoin implementation](https://github.com/bitcoin/bitcoin/blob/51a73c98627d3beb35989dfbc779f59fd92010d2/src/netaddress.cpp#L310) for obtaining the corresponding group of an IPv6 address for details. The `random_secret` is a random number with at least 32 bits of entropy generated once during the initial node startup and then stored persistently (a cryptographically secure random number generator is not necessary for the generation).

For every bucket b, we only accept 32 addresses in the collection `triedPeers`. This way the collection `triedPeers` contains at most 2048 peers. The proposed number of buckets and bound on the number of addresses per bucket should allow for a significant growth of the Lisk network, which currently contains approximately 500 nodes, while at the same time guaranteeing a useful grouping of addresses because the bucket size and number of buckets is not too large. If a new address is supposed to be added, but there are already 32 addresses with the same bucket b in the collection, then a randomly selected address is evicted and moved to the `newPeers` collection. The motivation for introducing the buckets as in Bitcoin is to ensure that the peers are randomly selected from a collection with sufficient diversity because IP addresses from the same group only hash to 4 different buckets. This protects against a local attacker that has a lot of IP addresses only in one group. The proposed peer selection process is described in the next subsection.

To each IP address in the `newPeers` collection, we associate a bucket b contained in {0,1,..., 127}. The bucket is computed from the IP address to be added, the IP address of the peer sending the addresses and a random secret of the node as follows:

```
group = /16 IPv4 prefix of peer’s IP address
source_group = /16 IPv4 prefix of peer sending the address to the Lisk node
k = Hash(random_secret, source_group, group) % 16
b = Hash(random_secret, source_group, k) % 128
```

This means that for a given `source_group` all IP addresses advertised by this `source_group` are hashed to at most 16 buckets. This means that from every `source_group` only a limited number of IP addresses are stored. In particular, a single malicious Lisk node cannot completely fill the `newPeers` collection of its peers by advertising many IP addresses, but only fill up 16 buckets. For every bucket b, we further only accept 32 addresses in the collection `newPeers`. In total, `newPeers` can therefore contain at most 4096 peers. Again, the chosen parameters are a good trade-off between allowing network growth while ensuring that the mechanism still successfully prevents attacks by peers from only very few IP address groups. If a new address is supposed to be added, but there are already 32 addresses with the same bucket b in the `newPeers` collection, then we do the following: We first evict any address that is more than 30 days old. If there is still no free slot, we evict a randomly chosen address.

When a peer is advertised, its `source_group` is stored together with its IP address and port so that it is available when a peer is moved between the `triedPeers` and `newPeers` collections.

### Peer discovery messages

A `getPeers` RPC is used to query a connected peer for a list of known IP addresses of Lisk nodes. In response the peer sends a message containing up to 1000 IP addresses. The IP addresses are selected as follows: Let n be a random number in the interval `[min(1000, #known peers *0.25), min(1000, #known peers*0.5)]`, where known peers are any peers in the `triedPeers` or `newPeers` collection. Then select `max(n,min(100, #known peers))` addresses at random from all known peers, i.e., peers in the `triedPeers` or `newPeers` collection. This means that nodes that are only
aware of a few IP addresses (at most 100) will respond by sending a list of all peers (at least `min(100, #known peers)`). Most nodes, however, will be aware of more IP addresses after a sufficient running time (around 500 for the current Lisk network) and therefore this RPC will only return a fraction of the known peers (25 % to 50 % of the peers) so that it is difficult to know which peers a Lisk node knows about. For instance, an attacker trying to poison the `newPeers` collection with a lot of IP addresses from malicious nodes cannot easily find out how many IP addresses were actually added to that collection. Furthermore, the list returned is shuffled for security reasons to ensure that it is impossible to infer the currently connected peers from the list. Note that the IP address of peers that declared that their IP address should not be advertised (see `advertiseAddress` flag defined in the next subsection) are never returned.

### Peer discovery and selection

In this section, we describe how the collections `triedPeers` and `newPeers` are filled and how the peers for outgoing connections are selected.

On startup, the node obtains a fresh list of IP addresses of Lisk peers as follows: If the `triedPeers` collection contains less than 100 entries, then the node first connects to all hardcoded seed nodes of the Lisk network (contained in the `config.json` of the specific network) and sends a `getPeers` message to fill its `newPeers` collection with new addresses. Afterwards, the peer disconnects from the hardcoded seed nodes (so that they are not overloaded). Then the node tries to establish `numOutConnections` outgoing connections as described below. The parameter `numOutConnections` is set to 20 as a default in the configuration. Only in special circumstances it could make sense for a user to change this value, but it is not advisable to do so in general. Users should therefore be discouraged and warned in the configuration file to change this value unless they exactly know what they are doing.
Setting the number of outgoing connections to 20 implies that on average a node also has 20 incoming connections and hence on average connections to 40 distinct peers. This number of connections provides a reasonable trade-off between the overhead caused by additional connections and good connectivity. If the node cannot successfully establish min(`numOutConnections`,20) outgoing connections within 30 seconds, then it also falls back and queries the hardcoded list of peers with a `getPeers` message and again tries to establish `numOutConnections` outgoing connection. Note that all received addresses are inserted in the `newPeers` collection unless they are already contained in the `triedPeers` collection.

In general, the outgoing connections are established by a Lisk node in the following cases:

- Establishing `numOutConnections` outgoing connections during the initial startup.
- A peer drops the connections or is banned.
- Outgoing connections are shuffled.

Every time an outgoing connection is successfully established, a `getPeers` message is send to obtain a list of IP addresses from that peer. The peer for an outgoing connection is selected as follows: If the collection `triedPeers` contains less than 100 entries, then a peer is selected uniformly at random from all known peers (i.e., collection `triedPeers` and `new peers`). Otherwise:

```
 x = (#entries of triedPeers)/(#entries of triedPeers + #entries of newPeers)
 r = max(x, 0.5)
```

Select a peer from collection `triedPeers` with probability r and a peer from the collection `newPeers` with probability 1-r. The peer in each of the collections is selected uniformly at random. Additionally, at most 3 outgoing connections for every network group (/16 IPv4 prefix) are allowed in all cases. Moreover, if an address is selected to which there already exists an incoming connection, then the selection process is run again. This way the set of incoming and outgoing connections are always disjoint. If a connection attempt fails, a different peer is selected by the procedure above. Peers in the collection `triedPeers` are moved to the collection `newPeers` after 3 consecutive failed attempts (i.e., the peer is selected randomly 3 times and every time the connection failed).
The assumption is that peer addresses of most Lisk nodes do not change often and hence removing peers after 3 failed attempts provides some tolerance for connection failures while preventing that the `triedPeers` collection contains to many dead IP addresses. Peers in the collection `newPeers` are immediately deleted after a failed connection attempt as malicious peers can advertise invalid IP addresses.

Once an outgoing or incoming connection is established, a `getSystemInfo` PRC is used to obtain the system information of the other peer. The call returns basic information about the node as in the current `status` message. Further, an additional flag `advertiseAddress` will be introduced in the system header. In the default setting the corresponding value is `true` and the IP address of the peer will be advertised in the whole network. Some peers may deactivate this advertisement in their configuration for security reasons and their IP address will not be advertised in the network (e.g. a delegate may be interested not to accept incoming connections and only establish outgoing connections to trusted peers, which will not further advertise the delegate’s IP).

Incoming connections are accepted to the maximum limit of `maxInConnections`. The parameter `maxInConnections` is set to 100 as a default in the configuration. Only in special circumstances it could make sense for a user to change this value, but it is not advisable to do so in general. In particular, lowering this value decreases the connectivity of the node so that blocks could be frequently missed, for instance. Setting this value to 0 and not accepting incoming connections only can make sense in special setups where a sufficient connectivity of the node is ensured. Users should therefore be discouraged and warned in the configuration file to change the value of `maxInConnections` unless they exactly know what they are doing. The limit of 100 incoming connections is chosen conservatively so that most nodes will have a lot of free slots for incoming connections as on average the number of incoming connections will be 20. This way new Lisk nodes can easily connect to the network as there are a sufficient number of free incoming connection slots.

Every time an incoming connection is established, its IP address is added to the `newPeers` collection. If the `advertiseAddress` flag in the system header was set to `false`, then the node has to remember not to advertise this address. If the limit of incoming connections is reached, a specific eviction method is called. A lot of care must be taken in the choice which node to evict so that it is extremely hard for an attacker to monopolize all incoming connections of a node. We use the same strategy as adopted in [Bitcoin](https://github.com/bitcoin/bitcoin/blob/17d644901bbd770578619545bbd8bc930fe6f2d9/src/net.cpp#L1000), namely, we protect a small number of peers for several distinct characteristics. In order to monopolize the incoming connections an attacker would have to be simultaneously better than the honest connected peers in all of the these characteristics. Additionally, `whitelisted` or `fixed` peers, as described in the section below, will never be evicted if the limit of `maxInConnections` incoming connections is reached. Moreover, if a `whitelisted` or `fixed` peer is establishing an incoming connection to a node and there is at least one incoming connection from a peer that is neither `whitelisted` nor `fixed`, then the connection is always accepted and a peer that is neither `whitelisted` nor `fixed` is evicted by the mechanism above.

### Whitelisted, blacklisted and fixed peers

There is further the possibility to declare certain peers as `whitelisted`, `blacklisted` or `fixed` in the configuration of a node for the specific network. A `whitelisted` peer is treated the same way as a normal peer with the exception that it is
initially added to the `triedPeers` collection, never removed from the `triedPeers` collection, never banned by the banning mechanism and the incoming connection from a `whitelisted` peer is never evicted. If a peer is `blacklisted`, then
no incoming or outgoing connection is ever established to that peer.
If a peer is declared as `fixed`, then the node tries to maintain a permanent connection to that peer. This means that an outgoing connection is established to that peer (if an incoming connection does not already exist) and that connection is never closed (in particular not during the periodic shuffling). Whenever a node detects that the connection to a `fixed` peer is closed in a corresponding event, it attempts to reconnect using the exponential backoff functionality from SocketCluster. A peer never stops trying to make reconnection attempts in a time interval of at most 1 min, as manually added `fixed` peers express a high importance to be connected to that peer and connection attempts cause only little system load. A Lisk node user can also detect the connection failures to a `fixed` peer immediately by the error log messages and react by manually removing the `fixed` peer from the configuration. Additionally, `fixed` peers can also not be banned.
In case users accidentally declare peers with more than one of the three attributes `blacklisted`, `whitelisted` and `fixed`, a warning message is shown. Moreover, `blacklisted` has precedence over all other attributes and `fixed` over `whitelisted`.

Users should be warned in the configuration file to only declare trustworthy peers as `whitelisted` as these could attack a node with a denial-of-service attack because the banning mechanism is deactivated. Moreover, users should be discouraged from declaring peers as `fixed`. In case this option is used, only very few peers (at most 4) should be declared `fixed` so that the connectivity of the node is not negatively impacted.
In special cases, such as exchanges or delegates, it could make sense to have one Lisk node that stays private, only connects to a sufficient number of trusted peers declared as `fixed` and has the `advertiseAddress` flag set to `false`. For this special setup there is a configuration option to exclusively connect to `fixed` peers, which also deactivates the periodic shuffling.

### Periodic shuffling

Over the course of 30 blocks (approximately 5 minutes), one outgoing connection is chosen uniformly at random and terminated at a random time during the interval of 30 blocks. The interval of 5 minutes is chosen to ensure that the network is sufficiently dynamic and at the same time the majority of the connections stay unchanged so that the peer-to-peer communication is not impaired. Every time an outgoing connection is terminated, a new outgoing connection is established via the mechanism described above. The exact number of blocks after which an outgoing connection is terminated may be changed after testing the new P2P layer.

### Banning mechanism

We suggest a banning mechanism inspired by the banning mechanism in [Bitcoin](https://github.com/bitcoin/bitcoin/pull/517). There is a ban score for every peer that is initially 0 and at most 100. It is increased every time a peer sends invalid information or too many messages. Once the ban score reaches 100, a peer is banned for a period of `banTime` seconds and the ban score is reset to 0. The default value of `banTime` is 86400, which corresponds to 24 h, and it can be changed by the user in the configuration. No information or reason is given, when the connection is dropped. Ban scores are stored in memory and not broadcast. Banned peers are further removed from the collections `triedPeers` and `newPeers` and stored in a separate data structure to be able to prevent a reconnection of the banned peer for `banTime` seconds. The peers that are declared `whitelisted` or `fixed` and the seed nodes are never banned. Moreover, the `blacklisted` peers stay permanently banned. Extreme care must be taken in order to not accidentally ban honest peers. Only invalid information that is never forwarded by an honest peer should lead to an increase in the ban score. The following table gives an overview about what is sanctioned by the banning mechanism:

| **Message Name**               | **Condition**                                          | **Ban Score ** | **Rationale**                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postBlockAnnouncement`        | Invalid schema                                         | 100            | Honest peers should send valid `postBlockAnnouncement` messages.                                                                                                                    |
| `postBlockAnnouncement`        | Invalid attribute values                               | 100            | Honest peers should send valid `postBlockAnnouncement` messages.                                                                                                                    |
| `postBlockAnnouncement`        | >4 send status message in a 10 s time window           | 10             | The number of `postBlockAnnouncement` messages by an honest peer in a 10 s time window is throttled at 3.                                                                           |
| `postBlock`                    | Invalid schema                                         | 100            | Invalid `postBlock` messages should not be forwarded by honest peers.                                                                                                               |
| `postBlock`                    | Invalid attribute values/signatures                    | 100            | Invalid `postBlock` messages should not be forwarded by honest peers.                                                                                                               |
| `postSignatures`               | Invalid schema                                         | 100            | Honest peers should send valid `postSignatures` messages.                                                                                                                           |
| `postSignatures`               | Invalid attribute values                               | 100            | Honest peers should send valid `postSignatures` messages.                                                                                                                           |
| `postSignatures`               | > 3 `postSignatures` messages in a 10 s time window    | 10             | Honest peers should send a `postSignatures` message only every 5 seconds.                                                                                                           |
| `postTransactionsAnnouncement` | Invalid schema                                         | 100            | Honest peers should send valid `postTransactionsAnnouncement` messages.                                                                                                             |
| `postTransactionsAnnouncement` | Invalid attribute values                               | 100            | Honest peers should send valid `postTransactionsAnnouncement` messages.                                                                                                             |
| `postTransactionsAnnouncement` | More than 3 announcements in a 10 s time window        | 10             | Honest peers should send an `postTransactionsAnnouncement` message only every 5 seconds.                                                                                            |
| `getSystemInfo`                | Invalid schema                                         | 100            | Honest peers should send valid `getSystemInfo` messages.                                                                                                                            |
| `getSystemInfo`                | Invalid attribute values                               | 100            | Honest peers should send valid `getSystemInfo` messages.                                                                                                                            |
| `getSystemInfo`                | More than one system header message for one connection | 10             | There should only be one `getSystemInfo` message when the connection is established.                                                                                                |
| `getPeers`                     | Invalid schema                                         | 100            | Honest peers should send valid `getPeers` messages.                                                                                                                                 |
| `getPeers`                     | Invalid attribute values                               | 100            | Honest peers should send valid `getPeers` messages.                                                                                                                                 |
| `getPeers`                     | More than one message after establishing connection    | 10             | Honest peers should send a `getPeers` message only once directly after establishing a connection.                                                                                   |
| `getBlocksCommon`              | Invalid schema                                         | 100            | Honest peers should send valid `getBlocksCommon` messages.                                                                                                                          |
| `getBlocksCommon`              | Invalid attribute values                               | 100            | Honest peers should send valid `getBlocksCommon` messages.                                                                                                                          |
| `getBlocks`                    | Invalid schema                                         | 100            | Honest peers should send valid `getBlocks` messages.                                                                                                                                |
| `getBlocks`                    | Invalid attribute values                               | 100            | Honest peers should send valid `getBlocks` messages.                                                                                                                                |
| `getTransactions`              | Invalid schema                                         | 100            | Honest peers should send valid `getTransactions` messages.                                                                                                                          |
| `getTransactions`              | Invalid attribute values                               | 100            | Honest peers should send valid `getTransactions` messages.                                                                                                                          |
| `getTransactions`              | More than 3 requests in a 10 s time window             | 10             | Honest peers should send a `getTransactions` message only after receiving a new `postTransactionsAnnouncement` message and in particular only request transactions every 5 seconds. |
| `getSignatures`                | Invalid schema                                         | 100            | Honest peers should send valid `getSignatures` messages.                                                                                                                            |
| `getSignatures`                | Invalid attribute values                               | 100            | Honest peers should send valid `getSignatures` messages.                                                                                                                            |

For the messages `getSignatures`, `postBlock`, `getBlocks` and `getBlocksCommon` a limit on the number of calls will be set once these functions have been revisited and throttled at a suitable rate. For keeping track of the number of Events/RPCs in a 10 second window for a message type, it is sufficient to use a counter that is reset to 0 every 10 seconds instead of counting the number of calls in a sliding 10 s window. For an exact specification of the banning mechanism, the different attributes and permitted value ranges of all messages need to be carefully reviewed to make sure that honest peers do not get banned accidentally.

### Block propagation

After receiving a block, the block first is validated and checked whether it has already been forwarded. New valid blocks are forwarded via a `postBlock` message to 16 randomly chosen connected peers while at least 8 `postBlock` messages are sent via outgoing connections. To all other connected peers a `postBlockAnnouncement` message is sent announcing the block by including the new height, broadhash and block ID. In the current system a block is pushed to 25 peers, but because of the relay limit on average a block is received 17 to 18 times by every peer assuming uniform network delays (and significantly less often if network delays differ a lot). For the proposed peer-to-peer module the eager push to 16 peers is quite close to this value and a conservative choice as there is an additional lazy push mechanism to all other peers (overall there are 40 connected peers on average). Testing may show that also a smaller value than 16 provides sufficient robustness of the network.

The `getBlocks` message can be used by the peer to obtain the new block. In order to efficiently answer a `getBlocks` message for a recent block, we propose to store the 5 most recent blocks in memory to avoid any database queries. After receiving an announcement of a block via a `postBlockAnnouncement` message, a peer does not immediately send a `getBlocks` message as it will likely still receive the block via the eager push mechanism. Instead the peer either waits 4 seconds or 7 seconds into the delegate time slot (whatever is smaller) and only then sends a `getBlocks` message to a randomly chosen peer that announced the block. If multiple different announcements are received, all different blocks are requested. As only very recent blocks are requested after a `postBlockAnnouncement` message, it is sufficient to only store the 5 most recent blocks in memory.

### Transaction propagation

Every 5 seconds up to 25 transaction are announced via an `postTransactionsAnnouncement` message containing a list of transaction IDs. The peer can then request a subset of transactions by using a `getTransactions` RPC that specifies a list of up to 25 transaction IDs. A node responds to a `getTransactions` RPC by sending the specified transaction objects.

## Backwards Compatibility

The changes will introduce a hard fork as the communication format between Lisk nodes changes.

## Reference Implementation

TBD
