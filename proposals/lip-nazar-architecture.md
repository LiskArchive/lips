```
LIP: LIP-nazar-architecture
Title: Flexible, Resilient and Modular Architecture for Lisk
Author: Nazar Hussain <nazar@lightcurve.io>
Status: Draft
Type: Standards Track
Module: All
```

# Abstract

This LIP proposes a new application architecture for Lisk Core, that would be flexible and modular.
The goal is to have an architecture which can be extended easily and stay resilient for the current and future growth targets.

# Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html).

# Motivation

Currently, the Lisk Core node software is composed of one single entity or an executable process which can consume only a single core of the available processor. It does have additional worker processes for our P2P layer (implementation of socketcluster) but since the master process is tightly coupled with the app script, we cannot consider it to be an independent unit in the application.

A limitation of single-entity architectures and tightly coupled logic is that a failure in one location can have a fatal impact on the whole system. For example consider the following scenarios:

* If a failure occurred while processing blocks received over the P2P network, the HTTP API layer would also crash.
* If an error occurred in the websockets master process, the node would also fail to respond over HTTP layer.

These are just a few use cases, the list goes on. In short, due to tight coupling of the various parts of the code and the fact that we use a single isolated process, we cannot ensure that each individual component of the application remains functional, in case another component (or more than one component) faces a problem.

# Rationale

When designing the architecture for a distributed and decentralised system, a few points need to be borne in mind:

* The network cannot be assumed to be reliable, so our P2P communication should be fail-safe.
* There is always a latency in the network, so our code should follow a principle of expected latency.
* We have no control or direct guidance over how most individuals install the node software, so the distribution of our software should be as easy to install as possible.
* A corollary of the previous point is that we have no control over the physical resources available on systems running our software, so we should aim to build software which can work well with a range of physical resources.
* All systems are susceptible to unplanned crashes, so our architecture should be resilient in such cases and support fail-over.

Taking note of the above points, our aim in redesigning the architecture of the Lisk Core node software is to achieve the following:

1. Identify components which should stay **functionally isolated** from each other
2. Design an architecture such that functionally isolated components can form the basis of a **multi-process application**, in order to utilise the potential of multiple hardware cores of the physical processor if available.
3. Design each component in **resilient way to tackle brittleness** of the distributed processing, so failure of one component have least impact on other. And components can recover individually.
4. Each or most of the components should **scale elastically** depending upon the available physical resources
5. Individual components should be flexible enough to be installed via **plugin pattern**.
6. Foundation work to extend scalability to network, to run different components on **different physical machines** and still operate mutually exclusive
7. Provide an **elegant API which can be extended easily** when creating new components for the Lisk Core software.
8. The work performed as part of the redesign should provide a **foundation for the Lisk SDK and DApp creation**, and afford us with insights into how to provide those products to users

These considerations have led us to the following architecture:

```
+---------------------------------------------------------------------+
|                              LISK CORE                              |
|+-------------------------------------------------------------------+|
||                              MODULES                              ||
||                                                                   ||
||+-------------------------------+ +-------------------------------+||
|||                               | |                               |||
|||        CORE MODULES           | |     PLUGGABLE MODULES         |||
|||                               | |                               |||
||+-------------------------------+ +-------------------------------+||
|+-------------------------------------------------------------------+|
|                                 /|\                                 |
|                                / | \                                |
|                                  |   CHANNELS                       |
|                                \ | /                                |
|                                 \|/                                 |
|+-------------------------------------------------------------------+|
||                            COMPONENTS                             ||
|+-------------------------------------------------------------------+|
||                            CONTROLLER                             ||
|+-------------------------------------------------------------------+|
+---------------------------------------------------------------------+
```

# Specification

Here you can find the specification for the each component and detailed diagram of the architecture.

## Lisk

Lisk Core in the above diagram denotes the complete ecosystem of the node software as composed by various units. The units should be glued together to work and drive the blockchain.

## Controller

The Controller will be a parent process responsible for managing every user interaction with each component of the ecosystem. E.g. restarting the node, starting a snapshot process, etc. It is an executable file which is the entry point to interacting with Lisk Core.

* The Controller will be responsible for the initialization of infrastructure-level components e.g. Database, Cache, Logger, etc.
* The Controller will also initialize each module separately. If any module is configured to load as a child process, then the Controller is responsible to do so.
* The Controller will define a set of events, such that each component can subscribe as an object in same process or over an IPC channel in case of different process. Most of the data flow will be handled through the propagation of such events.
* Each module can also define its own custom events or actions and will register that list with the Controller at the point of initialization. Thus the Controller will have a complete list of events which may occur in the modules of Lisk Core at any given time.

## Components

Components are shared objects within the Controller layer which each module can utilize, e.g. database objects, loggers, cache etc.

The following components are proposed currently.

### Database

This component will be responsible for all database activity in the system. This component will expose an interface with specific features for getting or setting particular database entities. But it will also expose a raw handler to the database object, so that each module can extend it if required on its end.

### Logger

This will be responsible for all application-level logging activity, and will log everything in JSON format. This central logger component will be passed to each module, where each module will extend the logger by adding module-specific fields to the JSON that gets logged.

### Cache

This component will provide basic caching capabilities, generic enough for any module to use if required.

### System

This component will provide a central registry of up-to-date system information, whether it is the current height of the network or constants such as the block version of the current installation.

## Modules

Modules are a vital part of the proposal here. These will contain all of the business logic and operational code for the ecosystem. Each module can reside within the main Controller process or can designate that it should be spawned as a child process of the Controller. This will enable the Lisk Core instance to distribute the necessary processing and utilize multiple cores. I.e. to make efficient use of the physical resources of the underlying system.

Modules can be further categorized into two types:

**Core Modules** will be shipped along with the Lisk Core distribution itself. These modules would constitute the minimum requirements to run a Lisk Core instance. That is, these modules together will provide the basic features required to run a functional node.

**Plugable Modules** should be distributed individually, such that they can be plugged into any Lisk Core instance and can be removed/disabled any time. Each pluggable module will extend the existing instance with a specific (and circumscribed) set of features.

### Interface

The implementation details of a module are ultimately up to the module developer, but by default a module should export an object with this structure.

```js
// Exported from the main file of the JavaScript package
export default {
  /**
   * A unique module name accessed throughout out the system.
   * If some module has already been registered with the same alias, an error will be thrown
   */
  alias: "moduleName",

  /**
   * Package information containing the version of the software and other details.
   * The easiest way is to refer to the relevant package.json.
   */

  pkg: require("../package.json"),

  /**
   * Supported configurations for the module with default values
   */

  defaults: {},

  /**
   * List of valid events to register with the Controller
   * Once the application is running, each event name will be prefixed by the module’s alias, e.g. moduleName:event1
   * Any module running on the instance will be able to subscribe or publish these events
   */

  events: [],

  /**
   * List of valid actions to register with the Controller
   * Once the application is running, each action name will be prefixed by the module’s alias, e.g. moduleName:action1
   * Action definition can be provided on module load with the help of the channels
   * Source module can define the action while others can invoke that action
   */

  actions: [],

  /**
   * The method to be invoked by Controller to load the module
   * Module developers should ensure that all loading logic is completed during the lifecycle of this method
   * The Controller will emit an event `lisk:ready` which a module developer can use to perform some activities which should be performed when every other module is loaded.
   * some activities which you want to perform when every other module is loaded
   *
   * @param {Channel} channel - An interface to a channel
   * @param {Object} options - An object of module options
   * @return {Promise<void>}
   */
  load: async (channel, options) => {},

  /**
   * The method to be invoked by the Controller to perform cleanup of the module.
   *
   * @return {Promise<void>}
   */
  unload: async () => {}
};
```

### Default Events & Actions

The following events and actions should be implemented in the redesigned Lisk Core and accessible by all custom modules.

#### Events

| Event                       | Description                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _module_:registeredToBus    | Fired when the module has completed registering its events and actions with the controller. So when this event is fired, the module can be sure that the Controller has whitelisted its requested events and actions. |
| _module_:loading:started    | Fired just before the Controller calls the module’s `load` method.                                                                                                                                                    |
| _module_:loading:finished   | Fired just after the module’s `load` method has completed execution.                                                                                                                                                  |
| _module_:unloading:started  | Fired just before the Controller calls the module’s `unload` method.                                                                                                                                                  |
| _module_:unloading:finished | Fired just after the module’s `unload` method has completed execution.                                                                                                                                                |
| lisk:ready                  | Fired when the Controller has finished initialising the modules and each module has been successfully loaded.                                                                                                         |

#### Actions

| Action                  | Description                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| lisk:getComponentConfig | A controller action to get configuration of any component defined in controller space. |

### Life Cycle

The module life cycle consists of the following events in the order listed below, assuming two modules m1 and m2.

**Loading**

1. m1:registeredToBus
1. m1:loading:started
1. m1:loading:finished
1. m2:registeredToBus
1. m1:loading:started
1. m1:loading:finished
1. lisk:ready

**Unloading**

1. m1:unloading:started
1. m1:unloading:finished
1. m1:unloading:started
1. m1:unloading:finished

For the initial implementation, sequential processing is recommended as shown above. The feasibility of loading modules in parallel could be researched as a potential future improvement.

## Channels

Modules will communicate to each other through channels. These channels will be event-based, triggering events across the various listeners. Modules running in different processes will communicate with each other over IPC channels.

Every module must export a `load` method, which accepts two arguments: a channel and an options object. The options object is simply the JSON object containing the options provided in the config file.

The `channel` parameter will be an instance of a channel, which will depend to some extent upon the type of module. For now we propose two types of channel:

| Channel Type        | Description                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| EventEmitterChannel | An implementation which facilitates communication with modules which reside in the same process as the Controller.        |
| ChildProcessChannel | An implementation which facilitates communication with modules which do not reside in the same process as the Controller. |

The Controller will be responsible for creating channels of the relevant sort depending on how it loads each module.

### Interface

Whichever channel implementation the module receives when its load method is called, it must expose a consistent interface defining the following four methods.

#### `subscribe`

Used to subscribe to events occurring on the main bus.

```js
channel.subscribe("lisk:ready", event => {});
```

This function accepts two arguments. The first is the event name, specifying also the name of the relevant module. The second argument is a callback which accepts one argument, which will be an instance of an [event object](#specification_channels_event).

#### `publish`

Used to publish events to the main bus, which will be delivered to all subscribers.

```js
channel.publish("chain:newTransaction", transactionObject);
```

This function accepts two arguments. The first one is the event name, specifying also the name of the relevant module. The second argument is the data object to be passed on by way of the event.

#### `action`

Defines an action for the module, which can be invoked later by other modules.

```js
channel.action("verifyTransaction", async action => {});
```

This function accepts two arguments. The first one is the action name without specifying a module name as the current module’s name will always be prefixed when the Controller registers the action. An action cannot be defined for an external module. The second argument is a callback which accepts one argument, which will be an instance of an [action object](#specification_channels_action).

#### `invoke`

Used to invoke an action for a module.

```
result = await channel.invoke('chain:verifyTransaction', transactionObject);
```

This function accepts two arguments. The first on is the event name, specifying also the name of the relevant module. The second argument is the data object to be passed on by way of the action.

### Event

Event objects should conform to a unified interface for all event communication between modules. It should be a simple JavaScript object with the following attributes. Each event must implement a serialize and deserialize mechanism so that a unified data format can be transported over channels.

| Property | Type   | Description                                              |
| -------- | ------ | -------------------------------------------------------- |
| name     | string | The name of the event which is triggered on the bus.     |
| module   | string | The name of target module for which event was triggered. |
| source   | string | The name of source module which published that event.    |
| data     | mixed  | The data which was send while publishing the event.      |

### Action

Action object should be a unified be a unified interface for all action based communication between modules. It should be a simple javascript object with following attributes. Event must implement a serialize and deserialize mechanism to get unified data format to be transported over channels.

| Property | Type   | Description                                                      |
| -------- | ------ | ---------------------------------------------------------------- |
| name     | string | Name of the event which is triggered on the bus                  |
| module   | string | The name of target module for which event was triggered.         |
| source   | string | The name of source module which invoked that event.              |
| params   | mixed  | The data which was associated with the invocation for the action |

# Reference implementation

A complete prototype implementing this proposal can be found at [https://github.com/LiskHQ/lisk-modular](https://github.com/LiskHQ/lisk-modular)

# Backwards compatibility

This proposal is intended to conform to the existing protocol specification without any amendments. So it will be 100% backward compatible at the point when this proposal is adopted.

# Appendix

**How deep the segregation of functionality should be?**

This proposal is not suggesting a microservices application design. The suggestion is to decouple the code into separate modules and later decide, which of these modules can run as separate independent process.

In the first phase of implementation, the suggestion is to separate three modules which will be run in separate processes. Once this reorganisation is complete we can investigate how best to improve the architecture with further segregations.

**How debugging will work with this architecture**

I felt nothing will change in regard to debugging. It would be same as we are doing right now. You will start the whole ecosystem of modules with one command and you you will see consolidated logs on console. So you will be doing same kind of debugging what we do right now by looking into logs.

For debugging IPC channels we, we will add extensive logging to catch any activity, so that would not be any issue. Fo node interactive debugging, I don’t think it will be break with this architecture.

**Using modules in other products**

Any module we design or create is designed to used in lisk-core ecosystem. As every module have a dependency of Lisk Controller to be available. So I don’t see using lisk-core module to any other product like “Commander” makes any sense.

For sidechains (not sure about what exactly sidechains would be), they can use lisk-core modules. As each module will have a very well defined set of actions and events and protocol to communicate. So if used properly, their functionality can be achieved in sidechains.

**Which tool we use for IPC communication**

We not finalizing any tool at the moment to implement IPC channel concept. Probable and available options are Custom Node implementation, PM2 implementation or look for any other tool for this purpose. But none of it been finalized, we will probably experiment with all options to choose to right one for us.

**What is database component?**

First thing first, every component, module and plugin mentioned in this proposal are standard npm packages. Afterwards, database component, that will be used to perform any kind of RDBMS activity. We call it component because it will be initialized and stay available on controller layer to be utilized by any other module (the way we are doing right now).

For modules which are spawned independently they create instance of this component on their end. For creating new instance, either they can pass the configuration from themself or can ask controller to share ONLY the configuration (json object) of particular component. So the respective module can use same configuration, override some or pass new configuration. In the end it will have its own instance of the component.

**How to refactor current code base?**

The above architecture require a lot of code change, or theoretically almost rewrite to all major components of the system. So to achieve this final target we suggest to go through following steps:

1. Convert app.js to a controller with module bootstrapping support
2. Convert current database, logger, cache and system to re-initializable components
3. Create “Chain” module actually consists of following modules:
   * Blocks Manager
   * Transactions Manager
   * Delegates Manager
   * Sync Manager
   * Transaction Pool
   * Forging Manager
4. Create “P2P” module actually consists of following modules:
   * Network Manager
   * Network Broadcaster
5. Create “API” module actually consists of:
   * HTTP API
6. Only “API” and “P2P” module will spawn their own child process, while rest of “Chain” module will reside inside controller.
7. The “Chain” module will contain everything as it is which currently reside in core, with same file structure
8. In upcoming iterations we can split up “Chain” module into role specific modules

Also look at [detail action plan to migrate](https://github.com/LiskHQ/lisk-modular/issues/12) to new architecture.
