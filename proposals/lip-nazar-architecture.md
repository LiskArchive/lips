<pre>
LIP: LIP-nazar-architecture
Title: Flexible, Resilient and Modular Architecture for Lisk
Author: Nazar Hussain <nazar@lightcurve.io>
Status: Draft
Type: Standards Track
Module: All
Created: 2018-09-06
Updated: 2018-09-06
</pre>

# Abstract

This LIP proposes a new application architecture for Lisk Core, that would be flexible and modular.
The goal is to have an architecture which can be extended easily and stay resilient for the current and future growth targets.

# Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html).

# Motivation

Currently, Lisk is composed into one single entity or an executable process which consumes only single core of the available processor. It do have additional worker process for websockets but since the master process is tightly coupled with app script, so we can’t consider it an independent unit in the application.

Limitation of single, composed and tightly coupled code logic causes fatal impact on the whole system. e.g. consider the following scenarios:

* If block processing from network failed, the HTTP Layer also crashed
* If some error occurred in websocket master process, forging of block also crashed

These are just few use cases, the list goes on. In short, due to tight coupling of code and single isolated process we can’t make each individual component of the application to stay functional, in case other component(s) faces any problem.

# Rationale

Unfortunately, there are few realities about the distributed and decentralized systems that we need to memorize before designing an architecture for such system. Here I just want to reiterate few of those.

* Network never been reliable, so our P2P communication should be fail-safe.
* There is always a latency in the network, so our code follow the assumption of expected latency.
* No control over installation of decentralized systems, so the distribution of modulized system should be easiest possible.
* No idea what kind of physical resources are there, so system can work with low and high resources availability.
* No matter what system always crash, so system architecture should be resilient and have fail-over configured.

With above given key points in mind, our target for Lisk architecture redesign is to achieve following:

1. Identify components which should stay **functionally isolated** to each other
2. Design the architecture to split components into **multi-process application** to utilize different hardware cores of the physical processor
3. Design each component in **resilient way to tackle brittleness** of the distributed processing
4. Each or most of the components should be **elastic to scale** depending upon available physical resources
5. Specific components should flexible enough to be **installed as plugin** pattern
6. Foundation work to extend scalability to network, to run different components on **different physical machines** and still operate mutually exclusive
7. Provide an **elegant API to extend** and create new components that can work with Lisk Core ecosystem
8. Provide basic research and **foundation towards Lisk SDK** and DAPPs

Here is the overview of the architecture.

<pre>
+---------------------------------------------------------------------+                                             
|                                LISK                                 |                                             
|+-------------------------------------------------------------------+|                                             
||                              MODULES                              ||                                             
||                                                                   ||                                             
||+-------------------------------+ +-------------------------------+||                                             
|||                               | |                               |||                                             
|||        CORE MODULES           | |     PULGABLE MODULES          |||                                             
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
</pre>  

# Specification

Here you can find the specification for the each component and detailed diagram of the architecture.

## Lisk

Lisk in above diagram describe the complete ecosystem of the Lisk Core composed of different units. The units should be glued together to work and drive the block chain.

## Controller

Controller will be parent process responsible for managing every user interaction with each component of the ecosystem. e.g. Restarting the core, Starting in snapshot mode. It is kind an executable file which is the entry point to start Lisk Core.

* Controller (app.js) will be responsible for initialization of infrastructure level components e.g. Database, Cache, Logger
* Controller will also initialize each module separately. If any module is configured to load as child process, then controller is responsible to do it.
* Controller will define set of events, that each component can subscribe as a residual process or over IPC channel. Most of the data flow will be handled through such events propagation.
* Each module can also define its own custom events or actions and will notify that list to controller on time of initialization. So controller will be having complete list of events in the lisk any time.

## Components

Components are shared objects on controller layer that each module can utilize, e.g. database objects, loggers, cache etc.

Following components are proposed currently.

### Database

This component will be responsible for each and every database activity in the system. This component will expose only interface with specific features for getting or setting any database entity. But it also expose some raw handler to database object, so each module can extend it if required on its on end.

### Logger

This will be responsible logging activity, and log everything in josn format. Main logger component will be passed to each module. Where each module will extend the logger to add module specific fields.

### Cache

This component will provide basic caching capabilities, so if any module want to use it.

### System

This component will provide a central registry to system information, whether its current height or any constant can be accessible through system.

## Modules

Modules are the vital piece in the puzzle. These contains all business logic and operational code of the ecosystem. Each module can reside into main controller process or can be spawn as child process of controller. This will enable running lisk instance to distribute the processing and utilize multiple cores and resource of physical system.

Modules can be categorized into further two categories.

**Core Modules** will be shipped along with the core itself. These modules would be minimum requirements to run any lisk instance. These modules together will ensure basic features to provide a functional node.

**Plugable Modules** should be shipped self-contained. Those can be plugged to any instance and can be removed/disabled any time. Each plugable module will extend the running instance with specific set of features.

### Interface

The implementation of each module is up-to user but by default it should generate an object with this structure.

```js
// Exported as main file to javascript package
export default {
  /**
   * A unique module name accessed through out the system.
   * If some module already registered with same alias, it will throw error
   */
  alias: "moduleName",

  /**
   * Package detail referring the version and other details
   * Easiest way is to directly refer to package.json for all details
   */

  pkg: require("../package.json"),

  /**
   * Supported configurations for the module with default values
   */

  defaults: {},

  /**
   * List of valid events which this module want to register with the controller
   * Each event name will be prefixed by module alias, e.g. moduleName:event1
   * Listing event means to register a valid event in the eco-system
   * Any module can subscribe or publish that event in the eco-system
   */

  events: [],

  /**
   * List of valid actions which this module want to register with the controller
   * Each action name will be prefixed by module alias, e.g. moduleName:action1
   * Action definition can be provided on module load with the help of the channels
   * Source module can define the action while others can invoke that action
   */

  actions: [],

  /**
   * Method which will be invoked by controller to load the module
   * make sure all loading logic get completed during the life cycle of load.
   * Controller emit an event `lisk:ready` which you can use to perform
   * some activities which you want to perform when every other module is loaded
   *
   * @param {Channel} channel - An interface to channel
   * @param {Object} options - An object of module options
   * @return {Promise<void>}
   */
  load: async (channel, options) => {},

  /**
   * Method to be invoked by controller to perform the cleanup
   *
   * @return {Promise<void>}
   */
  unload: async () => {}
};
```

### Default Events & Actions

Following events and actions should be implemented and available for custom module development.

#### Events

| Event                       | Description                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _module_:registeredToBus    | Fired when module completed registering its events and actions with the controller. So when this event fired, it make sure controller have white listed events and actions for particular module. |
| _module_:loading:started    | This event will be fired just before controller call module `load` interface.                                                                                                                     |
| _module_:loading:finished   | Fired just after module `load` interface finished execution.                                                                                                                                      |
| _module_:unloading:started  | This event fired just before controller call module `unload` interface.                                                                                                                           |
| _module_:unloading:finished | Fired just after module `unload` interface finished execution.                                                                                                                                    |
| lisk:ready                  | Controller event fired, when module initialization is finished and each module is loaded.                                                                                                         |

#### Actions

| Action                  | Description                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------- |
| lisk:getComponentConfig | A controller action to get configuration of any component defined in controller space. |

### Life Cycle

Module life cycle must consists of following events in the order mentioned below, if you have two modules m1 and m2.

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

We suggest to do sequential implementation in start as mentioned above. To load modules parallel we can research further as improvement.

## Channels

Modules will communicate to each other through channels. These channels will be event based channels, triggering events across the listeners. Modules running in different process will communicate to each other over IPC channels. Further we will extend channels to RPC behavior, that will enable to get direct response from different methods.

Every module `load` interface that you export accepts two arguments. e.g. `load: async (channel, options) => {},`. The second argument is simply the JSON object for the options provided in the config file.

First param `channel` is an instance of a channel implementation depending upon the type of module. For now we propose two implementations;

| Channel Type        | Description                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| EventEmitterChannel | An implementation used to communicate with module, which reside in same process as controller. |
| ChildProcessChannel | An implementation used to communicate with module, which reside in same process as controller. |

Controller will be responsible to create instance of specific channel depending on how its loading the module.

### Interface

What ever implementation you received in your module, it must expose with one consistent interface, specially these four methods.

#### subscribe

Subscribe to any event occurring on the main bus.

```js
channel.subsribe("lisk:ready", event => {});
```

It accepts two arguments, first one is the event name with specific module. Second argument is a callback which accepts one argument, which will be an instance of an [event object](#specification_channels_event).

#### publish

Its used to publish event on the bus, which will be delivered to all subscribers.

```js
channel.publish("chain:newTransaction", transactionObject);
```

It accepts two arguments, first one is the event name with specific module. Second argument is the data object passed through the event.

#### action

Define an action to for your module, which later can be invoked by other modules.

```js
channel.action("verifyTransaction", async action => {});
```

It accepts two arguments, first one is the action name without a module name, current module will always be prefixed. You can't define action for some other module inside your module. Second argument is a callback which accepts one argument, which will be an instance of an [action object](#specification_channels_action).

#### invoke

Its used to invoke an action for some module.

```
result = await channel.invoke('chain:verifyTransaction', transactionObject);
```

It accepts two arguments, first one is the event name with specific module. Second argument is the data object passed through the action.

### Event

Event object should be a unified interface for all event communication between modules. It should be a simple javascript object with following attributes. Event must implement a serialize and deserialize mechanism to get unified data format to be transported over channels.

| Property | Type   | Description                                              |
| -------- | ------ | -------------------------------------------------------- |
| name     | string | Name of the event which is triggered on the bus          |
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

You can find complete prototype implementing this proposal on [https://github.com/LiskHQ/lisk-modular]()

# Backwards compatibility

This proposal intended to implement same protocol specification without any amendments. So it will be 100% backward compatible to the point this implementation starts.

# Appendix

**How deep the segregation should be?**

This proposal is not suggesting to break every thing to microservices. Not at all. It's not a microservices application design. What we are suggesting is to decouple the code into separate modules and later decide, which of these modules can run as separate independent process. May be that requires communicating with other process or even just by communicating directly with database.

In first phase we suggested to create 3 modules which will be three different running processes. Once these three up, running and communicating to each other. We will do further segregations and see how to improve it.

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
