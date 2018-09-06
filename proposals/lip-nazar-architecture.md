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
The goal is to have an architecture which can be extended easily and stay resilient for the available and future growth targets.

# Copyright

This LIP is licensed under the [GNU General Public License, version 3](http://www.gnu.org/licenses/gpl-3.0.html).

# Motivation

Currently Lisk is composed into one single entity or an executable process which consumes only
single core of the available processor. It do have additional worker process for websockets but
since the mater process is tightly coupled with app script, so we can’t consider it a separate unit in
the application.

Due to limitation of single, composed and tightly coupled code logic, that cause fatal impact on the whole system.
Consider the following scenarios:

* If block processing from network failed, the HTTP Layer also crashed
* If some error occurred in websocket master process, forging of block also crashed

These are just few use cases, in short due to tight coupling of code and single isolated process
we can’t make each individual component of the application to stay functional even in case some
other component face any problem.

# Rationale

Unfortunately there are few realities about the distributed and decentralized systems that we need to
memorize before even think to design an architecture for such system. Here I just want to reiterate those.

* Network never been reliable, so our P2P communication should be fail-safe and don't crash the whole system.
* There is always a latency in the network, so our code sequences accept the assumption of latency.
* No control over installation of decentralized systems, so the distribution of modulized system should be easiest possible.
* No idea what kind of physical resources are there, so system can work with low and high resources availability.
* No matter what system always crash, so system architecture should be resilient and have failover configured.

With above given key points in mind, our target for Lisk architecture redesign is to achieve following:

1. Identify components which should stay **functionally isolated** to each other
2. Design the architecture to split components into **multi-process application** to utilize different hardware cores of the physical processor
3. Design each component in **resilient way to tackle brittleness** of the distributed processing
4. Each or most of the components should be **elastic to scale** depending upon available physical resources
5. Specific components should flexible enough to be **installed as plugin** pattern
6. Foundation work to extend scalability to network, to run different components on **different physical machines** and still operate mutually exclusive
7. Provide an **elegant API to extend** and create new components that can work with Lisk Core ecosystem
8. Provide basic research and **foundation towards Lisk SDK** and DAPPs

And here is the overview of the architecture.

<pre>
+------------------------------------------------------------------------------------------------------+            
|                                                LISK                                                  |            
|+---------------------------------------------------------------------------------------------------+ |            
||                                              MODULES                                              | |            
||                                                                                                   | |            
||+----------------------------------------------+  +-----------------------------------------------+| |            
|||                                              |  |                                               || |            
|||                 CORE MODULES                 |  |                 PULGABLE MODULES              || |            
|||                                              |  |                                               || |            
||+----------------------------------------------+  +-----------------------------------------------+| |            
|+---------------------------------------------------------------------------------------------------+ |            
|                                                  /|\                                                 |            
|                                                 / | \                                                |            
|                                                   |   CHANNELS                                       |            
|                                                 \ | /                                                |            
|                                                  \|/                                                 |            
|+---------------------------------------------------------------------------------------------------+ |            
||                                             COMPONENTS                                            | |            
|+---------------------------------------------------------------------------------------------------+ |            
||                                             CONTROLLER                                            | |            
|+---------------------------------------------------------------------------------------------------+ |            
+------------------------------------------------------------------------------------------------------+            
</pre>  

# Specification

Here you can find the specification for the each component and detailed diagram of the architecture.

## Lisk

Lisk here in above diagram describe the complete ecosystem of the Lisk Core composed of different units.
The units should be glued together to work and drive the block chain.

## Controller

Controller will be parent process responsible for managing every user interaction with each component of the ecosystem.
E.g. Restarting the core, Starting in snapshot mode. It is kind an executable file which is the entry point to start Lisk Core.

* Controller (app.js) will be responsible for initialization of infrastructure level components e.g. Database, Cache, Logger
* Controller will also initialize each module separately. If these are scalable (shown as dotted lines) modules then will be spawned as child process.
* Controller will define set of events, that each component can subscribe as a residual process or over IPC channel. Most of the data flow will be handled through that events propagation.
* Each module can also define its own custom events and will notify that list to controller on time of initialization. So controller will be having complete list of events in the lisk any time.

## Components

Components are shared objects on controller layer that each module can utilize, e.g. database objects, loggers, cache etc.
Following components are proposed currently.

| Name     | Description                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database | This component will be responsible for each and every database activity in the system. This component will expose only interface with specific features for getting or setting any database entity. But it also expose some raw handler to database object, so each module can extend it if required on its on end. |
| Logger   | This will be responsible logging activity, and log everything in josn format. Main logger component will be passed to each module. Where each module will extend the logger to add module specific fields.                                                                                                          |
| Cache    | This component will provide basic caching capabilities, so if any module want to use it.                                                                                                                                                                                                                            |
| System   | This component will provide a central registry to system information, whether its current height or any constant can be accessible through system.                                                                                                                                                                  |

## Modules

Modules are the vital piece in the puzzle. These contains all business logic and operational code
of the ecosystem. Each module can reside into main controller process or can be spawn as child process
to controller. This will enable running lisk instance to distribute the processing and utilize
multiple cores and resource of physical system. Modules can be categorized into further two categories.

**Core Modules** will be shipped along with the core itself. These modules would be minimum requirements
to run any lisk instance. These modules together will gave barebone functionality to provide a functional node.
**Plugable Modules** should be shipped self-contained. Those can be plugged to any instance and can
be removed/disabled any time. Each pluggable module will extend the running instance with
specific set of features. Plugable modules will reside inside main controller process.

See further detailed [Module Specification Document](../modules/README.md)

Also check [proposed modules and their actions and events](./modules_events_and_actions.md)

## Channels

Modules will communicate to each other through channels. These channels will be event based channels,
triggering events across the listeners. Modules running in different process will communicate to
each other over IPC channels. Further we will extend channels to RPC channels,
that will enable to get direct response from different methods. Famous PM2 is using both approaches
to communicate between running apps.

See further detailed [Channel Specification Document](../modules/README.md#channels)

## Flows

Here you can find specification of different activities or flows during the application life cycle.

### Controller Startup Flow

![](./assets/Controller%20Startup%20Flow.png)

### Module Registration Flow

![](./assets/Module%20Regisration%20Flow.png)

### Module Life Cycle

![](./assets/Module%20Life%20Cycle.png)

### Component Initialization for self contained module

![](./assets/Components%20Initialization.png)

# Execution Plan

The above architecture require a lot of code change, or theoretically almost rewrite to all major
components of the system. So to achieve this final target I suggest to go through following steps;

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

# General Explanation

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
