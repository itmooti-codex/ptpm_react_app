# Async Behavior

All async operations return `rxjs` Observables. No exceptions. You can convert them to a Promise by calling the Observable's `toPromise()` method: `observableResponse.toPromise()`. The Promise can then be used in async await.

# Including the SDK

```html
<script
  async
  data-chunk="client"
  src="https://static-au03.vitalstats.app/static/sdk/v1/latest.js"
  crossorigin="anonymous"
/>
```

The `/v1/` in the URL indicates the version of the public API exposed by the SDK. This means that if there is a breaking change, the `/v1/` will be incremented to `/v2/`.

However, there are frequent updates to the underlying code that do not affect the SDK's API. Therefore, using `/latest.js` will ensure the most up-to-date version is included on the page without having to update URLs on all pages.

**Note:** `/latest.js` is a CloudFront redirect. It checks for the latest version every ~10 minutes. This allows the actual script to take advantage of long-term caching, therefore speeding up initialization.

# Initializing the SDK

## initVitalStats(options)

Once the script is loaded, it sets the following function on `window` that must be called to start an SDK for an account (its details must be loaded):

```javascript
/**
 * Initialize an SDK for a client.
 *
 * @function initVitalStatsSDK
 *
 * @param {Object} options - An Object consisting
 * of the options to initialize an SDK instance.
 *
 * @param {string} options.slug - The slug of
 * the Entity that the SDK instance should be
 * associated with.
 *
 * For example, `awc`, `phyx`, etc.
 *
 * @param {string} options.apiKey - A valid
 * API key for the Entity. This would
 * be the API key created by visiting the client's app
 * (e.g., `https://awc.vitalstats.app`) and navigating to the
 * `Api Keys` section.
 *
 * @param {boolean} [options.enableHistoryModels = false] - If
 * `true`, the History variations of each model will also
 * be instantiated. Unless you plan on querying the
 * history models (doubtful), you do not need this.
 *
 * **Note:** This is not related to the time travel
 * functionality. This controls whether to activate
 * the archive models (history models).
 *
 * @param {boolean} [options.isDefault = false] - Provide `true`
 * to indicate this instance represents the default
 * that should be returned by the following
 * functions added to `window`:
 *
 * - `getVitalStatsPlugin()`
 * - `getVitalStatsStore()`
 *
 * Each of those methods accepts a `slug` parameter,
 * but if one is not provided, and one is initialized
 * with `options.isDefault = true`, this SDK
 * will be used.
 *
 * This should always be `true` unless planning
 * on initializing an SDK for more than one client
 * on the same page.
 *
 * @param {boolean} [options.forceRecreate] - If `true`,
 * the client will be recreated. Note that this is
 * not possible until an in-flight setup completes.
 * Meaning, you can only force recreate a client
 * after it finishes setting up.
 */
function initVitalStats(options) {
  // ...initialization
}
window.initVitalStats = initVitalStats;
```

As stated in the function's documentation, provide `options.isDefault = true` unless you plan to instantiate a client connection for more than one account on the page.

The function returns an Observable that emits once the client is ready. You can convert the Observable to a promise as stated previously:

```javascript
initVitalStats({
  // ...options
})
  .toPromise()
  .then(({ plugin, store }) => {});
```

If you call `initVitalStats()` with `options.slug` equal to one that has already been instantiated (or is in the process of instantiating), the same Object will be emitted by the returned Observable. Duplicate instances will not be created unless expressly setting `options.forceRecreate = true`.

You **do not** need to try to pass the returned `plugin` and `store` around in the app. Additional functions are added to the `window` Object for this purpose (see next):

## getVitalStatsPlugin(slug)

Synchronous function that returns the `plugin` for the client. More details about the `plugin` are available further in this document.

If you called `initVitalStats({ isDefault: true })` (most likely), you **do not** need to provide the `slug` parameter. Otherwise, for situations where there are multiple accounts instantiated on the same page, provide the `slug` of the client you want to retrieve.

This function is set on `window`.

## getVitalStatsStore(slug)

Synchronous function that returns the underlying store for the `plugin`. This allows you to do a lot of advanced things, but it's not something to be concerned with right now. Use the `plugin` instance.

This function is set on `window`.

# General Advice

I **strongly** recommend that you use constants for model names that then use keys that are generic for every account. Populate the Object based on the account, and make the Object available everywhere in your app.

Each Model instance has a `schema` Object that contains the Ontraport `objectId`, making it easy to map models to a constant.

Like this:

```javascript
initVitalStats({
  slug: 'awc',
  apiKey: '<api key>',
  isDefault: true,
}).subscribe(({ plugin }) => {
  /*
   * I'm not showing the full implementation, but create
   * some kind of Object that maps
   * ontraport Object IDs to the name of
   * the constant you want to use to
   * identify that Object
   */
  const objectIdToConstant = {
    '0': 'CONTACT',
    // ...etc.
  }
  const MODEL_NAMES = {};
  const models = plugin.getState();
  let schema, props;
  for(const modelName in models) {
    schema = models[modelName].schema;
    /*
     * The plugin's state also includes
     * system models. Here's how you can
     * identify Ontraport models:
     */
    if ((props = schema.props) && props.dataSourceType === 'ontraport') {
      // You might want to also make sure you care about the
      // model (e.g., its objectId exists in your `objectIdToConstant` Object).
      MODEL_NAMES[objectIdToConstant[props.objectId]] = schema.name;
    }
  }
  window.MODEL_NAMES = MODEL_NAMES;

  // Then, in your code you can do stuff like this:
  const bob = await getVitalStatsPlugin()
    .switchTo(MODEL_NAMES.CONTACT)
    .query()
    .where('email', 'bob@gmail.com')
    .fetchOneRecord()
    .toPromise();
})

```

# Plugin

Think of the `plugin` like a Database. Its `state` Object consists of `Model` instances for each model in the client's account (plus system models).

## Connections

The connections are handled automatically. You don't need to do anything. It will use a WebSocket, and it will automatically manage the entire lifecycle. If it is disconnected, it will automatically try to re-establish the connection, and once established, it will **restart all subscriptions**, and it will also send up any operations that you execute while the client was disconnected. You do not need to worry about it.

## Time Travel

The SDK fully supports time travel (e.g., `undo`/`redo`) so you can provide users with a nice interface to undo or even redo changes they make.

However, mutations are not automatically undoable because it doesn't make sense for every change to be undoable. You'll probably only want to make a mutation undoable when it is a change performed by a User.

Here's how:

```javascript
const mutation = await getVitalStatsPlugin()
  .mutation()
  .undoable() // Must be called before making any changes!!
  .switchTo("AwcContact")
  .update((query) =>
    query.where("email", "bob@gmail.com").set({ lastName: "smith" })
  )
  .switchTo("AwcLesson")
  .update((query) =>
    query.where("id", 24).set({
      // ...properties to update
    })
  )
  // after queing up all your changes, execute it.
  // Always provide `true` to execute(). Don't worry
  // about what it does right now, just always include it.
  .execute(true)
  .toPromise()
  .then((mutation) => {
    if (mutation.isCancelling) {
      console.log("Mutation Failed.");
    } else {
      console.log("Mutation Scucessful.");
    }
  });
if (mutation.isCancelling) {
  console.log("Mutation Failed.");
} else {
  console.log("Mutation Scucessful.");
}

// Undo all those changes (move backward 1 step in time):
await getVitalStatsPlugin().timeTravel(-1);

// Redo all those changes (move forward 1 step in time):
await getVitalStatsPlugin().timeTravel(1);

// You can also jump backwards and forwards in time
// by providing the appropriate number of steps
// that should be taken. Note that there are
// only steps available equal to the number of
// undoable mutations you have made. If you
// exceed that number (either positive or negative),
// it'll just assume the max available.
await getVitalStatsPlugin().timeTravel(-3); // Move back 3 steps
await getVitalStatsPlugin().timeTravel(3); // Move forward 3 steps
```

> **Time travel tip:** Register listeners for `ctrl+z` and `ctrl+shift+z` and then call `plugin.timeTravel(-1)` or `plugin.timeTravel(1)`

## Notable Plugin Functions

There are a lot of functions exposed on the Plugin, but here are the ones you will use the most:

### switchTo(modelName)

Returns the `Model` instance that represents the model indicated by `modelName`. More details about `Model` instances further in this document, but this function will be the one you use the most.

This function is also available on each `Model` instance. For example:

```javascript
const ContactModel = getVitalStatsPlugin().switchTo("AwcContact");
const OrderModel = ContactModel.switchTo("AwcOrder");
```

It is just shorthand for:

```javascript
getVitalStatsPlugin().getState().AwcContact;
```

### getState()

Retrieve a plain Object containing `Model` instances of all models associated with the client's account.

> Critical: Do not mutate this Object, or any state for that matter, without using a Mutation or the Record's setState() method (detailed later).

This same function exists on each `Model` and `Record` instance as well. The only difference is what is in the Object it returns:

```javascript
const plugin = getVitalStatsPlugin();
console.log(plugin.getState()); // { "someModelName": Model, "anotherModelName": Model }

const ContactModel = plugin.switchTo("AwcContact");
console.log(ContactModel.getState()); // { "id1": Record, "id2": Record }

const contactRecords = ContactModel.getState();
console.log(contactRecords["<id_of_record>"]); // { firstName: "Bob", "email": "bob@gmail.com" }
```

### subscribe((plugin) => {})

This function exists on all `Plugin`, `Model`, and `Record` instances, just like `getState()`. The only difference is what you are subscribing to.

The function you provide to `subscribe()` will be called with the instance whenever that instance's state changes.

Example of subscribing to the Plugin:

```javascript
/**
 * @type {import("rxjs").Subscription}
 */
const subscription = getVitalStatsPlugin().subscribe((plugin) => {
  // The `__changes` property provides an Object whose keys are names of
  // models that changed, and its values will be the type of change that
  // occurred. It will always be `"updated"`, you're not doing dynamically
  // instantiated models right now.
  console.log("The following models changed: ", plugin.__changes);
  // You can check the `__changesEvent` to determine whether it
  // was an `optimistic` state change (pending commit once confirmed by the backend),
  // or `commit` (indicating it is confirmed by the backend).
  console.log("Change type: ", plugin.__changesEvent); // One of: "optimistic" or "commit"
});

// To stop the subscription:
subscription.unsubscribe();
```

You can do the same for any `Model` or `Record`. The only difference is your callback would get the `Model` or `Record` instance, and only when that particular `Model` or `Record`'s state changes.

# Model

The `Model` instance allows you to:

- Retrieve the `Record` instances of each of the Model's records that have been loaded into local state via a query.
- Execute queries/mutations/subscriptions

## Notable Model Functions

Remember that the `Model` shares many of the same functions as the `Plugin`:

- subscribe()
- getState()

### query()

Retrieve a `Query` instance. This will be your primary query instance. See the `Query` section for details.

### mutation()

Retrieve a `Mutation` instance to create, update, or delete records. See the `Mutation` section for details.

# Record

Records can be loaded into local state, either by creating them or by querying for them.

Each Record is an instance that has underlying state, just like a `Plugin` and `Model`. This means it has the same functions as they do:

- getState()
- subscribe()

It also has accessors for each field defined for the Model. This means you can access them as properties, you don't need to `record.getState()['propertyName']`. Instead, you can just do `record['propertyName]'`, or `record.propertyName`.

The same is true for its virtual fields (e.g., `postRecord.comments`).

The `field` and `virtualField` accessors are enumerable. So in short, you can use a record just like a plain Object when it comes to reading values.

However, **do not** set property values using the accessor. Use a mutation, or the record's special `setState()` method detailed below.

## Notable Record functions

### setState(nextState, undoable)

The `Record` exposes a convenience method for easily updating its state without going through the normal `Mutation` process.

```javascript
record.setState({
  property1: "newValue",
  // ...etc. You only need to provide the properties and values that are changing.
});

// You can also subscribe to the returned Observable
// (or convert it to a Promise) to be notified when
// the change is complete:
record
  .setState({
    // ...changes
  })
  .subscribe((record) => {
    // change is complete. The `record` provided as
    // the only parameter is the same as the original
    // `record`, record instances don't change, only
    // their underlying state.
  });

// Or, with async/await:
await record.setState({}).toPromise();

// You can also provide `true` as the 2nd argument to make
// the change undoable:
record.setState(
  {
    // ...changes
  },
  true
);

// To undo the change:
getVitalStatsPlugin().timeTravel(-1); // -1 undoes whatever last changes, -2 jumps back 2.

// To redo the change:
getVitalStatsPlugin().timeTravel(1); // Move forward 1 step
```

# Query

## Basics

```javascript
/*
 * The MODEL_NAMES reference is assuming you
 * setup a constants Object like I showed at
 * the beginning of this document.
 */
const contactModel = getVitalStatsPlugin().switchTo(MODEL_NAMES.CONTACT);
const query = contactModel
  .query()
  // Signature: fieldName, operator|value, value
  // The `=` operator is implied, so you
  .where("email", "like", "%@gmail.com")
  // The `=` operator is implied
  .andWhere("email", "sam@gmail.com")
  // But you can still provide it if
  // you want.
  .orWhere("email", "=", "bob@gmail.com")
  // There are also functions for `whereIn`
  .andWhereIn("firstName", ["Bob", "Jane"])
  // But whereIn() is just a convenience for:
  .andWhere("firstName", "in", ["Bob", "Jane"])
  /*
   * You can also provide an Object with
   * multiple properties. These will be
   * interpreted as "and":
   */
  .orWhere({
    email: "bob@gmail.com",
    lastName: "Smith",
    // You can also include arguments
    // for related models using their
    // virtual field name:
    posts: {
      isPublished: true,
    },
  })
  // Provide a function to create grouped arguments
  .orWhere((query) =>
    query
      /*
       * For timestamp fields, you can provide
       * the epoch timestamp, or a Date instance.
       */
      .where("created_at", ">", new Date("2024-08-09"))
      .andWhere("updated_at", "<", Math.round(Date.now() / 1000))
  )
  /*
   * Assuming the Contact record has a `posts` virtual field,
   * provide the name of the virtual field as the
   * 1st argument, followed by the callback function
   * to construct the query - same as a grouped query
   * just with 1 extra argument.
   */
  .andWhere("posts", (query) => query.where("title", "like", "%my content%"))
  /*
   * You can also use arguments that check
   * values within a JSON field. Provide
   * the path to the value you want to query.
   *
   * This example would check that a record has:
   * `some-json-field-name.key1.key2 > 10`
   */
  .orWhere(["some-json-field-name", "key1", "key2"], ">", 10)
  /*
   * All `where` methods have a `not` variation.
   *
   * - whereNot()
   * - andWhereNot()
   * - orWhereNot()
   * - whereNotIn()
   * - orWhereNotIn()
   * - andWhereNotIn()
   *
   * These have the exact same signature
   * as the regular ones, and are identical
   * in all ways. They simply negate the
   * comparison, that's all. Meaning, you can
   * use them with grouped queries, virtual
   * field queries, JSON, etc.
   */
  .orWhereNot("lastName", "Smith")
  .orWhereNot((query) =>
    query
      .where("lastName", "like", "%Smith%")
      .andWhere("firstName", "like", "%Bob%")
  )
  /*
   * Include records on related models using
   * the virtual field name - just like you
   * do in your Graphql queries. The signature
   * is the same as a grouped query, the only
   * difference is you provide the name of the
   * virtual field as the first argument,
   * and you can also use `select()` to
   * choose the fields you want returned.
   */
  .include("posts", (query) =>
    query
      .select(["id", "title", "content"])
      .where("somePostField", "someValue")
      .andWhere()
  )
  // Or, if you don't need to filter them:
  .includeFields("posts", ["id", "title", "content"])
  // Or, include them all
  .includeFields("posts")
  // You can also limit the result set:
  .limit(100)
  // Or paginate it
  .offset(100);
```

## Variables

Any argument value can be provided as a variable. Provide `:varName` as the value, then include the variables when you execute it:

```javascript
query
  .where("email", ":email")
  .orWhereIn("firstName", ":names")
  // If you use variables for limit or offset,
  // they must be called `:limit` and `:offset`.
  // But you can use whatever variable name
  // you want for where() argument values.
  .limit(":limit");

// Then, when you execute, provide your variables Object
// just like you do when submitting to Graphql:
query.fetch({
  variables: {
    email: "bob@gmail.com",
    names: ["sam", "bob", "susan"],
    limit: 100,
  },
});
```

## Graphql

### To

If you want the GraphQL representation, call toGraphql().

Provide `true` or an Object ({}) to output a string. Otherwise, it outputs the Graphql Document, which you probably won't ever want.

```javascript
console.log(query.toGraphql()); // document
console.log(query.toGraphql(true)); // Graphql string, what you usually write
```

You can provide options to pretty print the string, which is nice for debugging. The defaults are fine, so you can just provide an empty Object.

Note that this uses prettier, which is lazy loaded. So it won't be available the first time you call it. But it will trigger it to load, and the next time you call it (after async delay), and it will pretty print:

```javascript
console.log(query.toGraphql({})); // Pretty printed string.
```

### From

This is likely going to be really helpful for you, because it can automatically convert your existing queries into query instances:

```javascript
const query = contactModel.query().fromGraphql("<graphql string>");
// You can even modify it just like any other query:
query.deSelectAll().select(["firstName", "lastName"]);
```

## calc queries

You can convert any query to a `calc` query and any calc query to a standard query (provided the query doesn't use any aggregate methods like count(), avg(), etc.).

This is how the Code Editor in the Query Builder does it when you click those options in the Grpahql editor.

```javascript
// To calc query
query.getOrInitQueryCalc();

// Calc query to standard
query.convertCalcToSelect();
// You can also drop the aliases if you want:
query.convertCalcToSelect().removeAllFieldAliases();
```

If you invoke one of the aggregate methods on the query instance, it will automatically convert it to a `calc` query:

```javascript
query
  .count('*', 'myAlias'); // same as `query.count('id')
  .sum('fieldName', 'myAlias')
  .avg('fieldName', 'myAlias')
  .min('fieldName', 'myAlias')
  .max('fieldName', 'myAlias')
  .median('fieldName', 'myAlias')
  .stdDev('fieldName', 'myAlias')
  .variance('fieldName', 'myAlias')
  // You can use the standard `select()`, it'll
  // automatically make it a `field` argument.
  // However, the unique alias will be auto-assigned
  // (defaults to the field's name).
  // So you can use the `field()` method
  // directly to choose an alias:
  .select([ 'fieldName1', 'fieldName2' ])
  .field('fieldName', 'myAlias');
```

## Execution

### Base Methods

1. get() - sync - Returns records from local state, no API calls
2. find() - async - Attempts to resolve from local state. If not available, it will fetch. The only way it would make sense for you to use find() would be when you use ids in your query. Otherwise, it'll always fetch because you don't set up any unique constraints, which is what it uses to determine whether it has all the records necessary to satisfy the query already available in local state.
3. fetch() - async - Fetches from the server and adds the records to local state.
4. fetchDirect() - async - Fetches the record data from the server, but does not generate records to represent them in local state. This is equivalent to how you execute your queries now.
5. subscribe() - async - create a subscription
6. localSubscribe() - async - subscribe to records locally. Does not generate a subscription on the server, but if you alter records that match the query, it'll emit the records.

`get`, `find`, and `fetch` all return what's called a `payload` Object. It's a plain Object, and all but the `fetchDirect()` method will have `payload.records` with the records that satisfy the query (or `null`). The `fetchDirect()` will have `payload.resp = [{}, {}]` (or `null`).

> All results - whether records or `resp` Array - will already be parsed from Graphql. Meaning, you don't need to access them from `data.calcContacts` or whatever the key normally is in the raw Graphql response. The whole execution process is entirely transparent for you. Just use the results.

### Variations

There are convenience methods available to alter the format of the returned results:

```javascript
// emits an Object containing
// the records, keyed by their ID.
// Or, null if none satisfy the query.
await query.fetchAllRecords();
// emits a single record, or null if none satisfy the query
await query.fetchOneRecord();

// Same for get
query.getOneRecord();
query.getAllRecords();

// There are also Array methods:
query.getAllRecordsArray();
await query.fetchAllRecordsArray();
```

### !!Important To Know About Query Execution

Query instances will automatically destruct after you execute it. Meaning, you cannot execute the same query 2x _unless_ you call `noDestroy()`:

```javascript
const records = await query
  .fetchAllRecords()
  .pipe(toMainInstance(true))
  .toPromise();
// query is now destroyed, this will result in an error:
query.getAllRecords();

// To use it more than once, call `noDestroy()` at any time on the query.
// It doesn't have to be right before execution.
const records = await query
  .noDestroy()
  .fetchAllRecords()
  .pipe(toMainInstance(true)) // more on this below
  .toPromise();
// Now there won't be an error:
query.getAllRecords();

// But if you use noDestroy(), make sure to cleanup at some point:
query.destroy();
```

Secondly, for `fetch()` or `find()`, pipe it through `toMainInstance(true)`.

I have exposed this operator on window: `window.toMainInstance`

I'll explain why at a later time, it's more than you need to know right now.

Here's a list of when you need to use it:

1. get() & variations - no
2. find() & variations - yes - query.find().pipe(toMainInstance(true))
3. fetch() & variatoins - yes - query.fetch().pipe(toMainInstance(true))
4. fetchDirect() & variations - no

# Mutation

I'll get you more on this tomorrow, but you can probably already figure it out, because a Mutation is just queries with values associated with them.

The big thing to understand is that a Plugin has a mutation instance that "controls" the model mutations involved in the single transaction.

This means you can make changes across many different models and records all in the same mutation. The changes will be atomic; either they all succeed, or all will be rolled back.

Each model `Mutation` instance has a `controller` property that references the plugin `Mutation` instance. Don't let the `controller` name confuse you - it's just a holdover from years ago. It's a plugin `Mutation` instance.

Each model & plugin `Mutation` instance has a `switchTo()` method that retrieves the existing mutation instance for the model, or creates it if it doesn't exist.

Once you've queued up all the changes you want to make, call `execute()` on either model or plugin `Mutation` - it doesn't matter which.

> Tip: If you already have a reference to the record(s) you want to mutate, it can be easier to just provide the record(s) to `update()` or `delete()`, rather than providing a function and constructing a query. This doesn't apply to create, since no record would exist yet. Example shown below.

```
// To start, get a mutation. You can do this from the `plugin`
// and then `switchTo()` the Model whose records you want
// to mutate, or you can do it from a Model instance and it'll
// instantiate the Plugin Mutation automatically. Therefore,
// these 2 are identical:
const plugin = getVitalStatsPlugin();
plugin.mutation().switchTo('AwcContact');
plugin.switchTo('AwcContact').mutation();

// For the rest of these examples, assume `mutation`
// is a reference to the mutation instance for
// the model (however you want to instantiate it).

// UPDATES:
mutation.update(query => query
  .where('name', 'bob')
  .set({
    // ...values to update
  })
);
// If you have the record(s) already, you can
// just provide them. It accepts a single record,
// Array of records, or Object containing records.
// But DO NOT provide state directly, the Object
// or Array you provide will be mutated.
// I'll explain why later, doing so requires
// explanation how you can do more advanced stuff
// that isn't applicable right now.
mutation.update(recordOrRecords, {
  // ...values to update. These will be
  // applied to ALL records you provide.
});

// DELETES:
mutation.delete(query => query
  .where('name', 'bob')
  // ...more arguments if you need it.
  // But there aren't any values to
  // set. A delete is just a query.
);
// You can also provide the function
// with the record(s) directly, just
// like with update:
mutation.delete(recordOrRecords);

// CREATE - It'll give you back the optimistic
// record(s) for the state you provide:
const records = mutation.create([{
  // ...state for record 1
}, {
 // ...state for record 2
}]);

// If you want to only create 1 record, you must
// use the `createOne()` method. The delete()
// and update() methods accept either 1 or many,
// but the create() method only accepts many.
// Use the createOne() method to create only 1.
// Note that it's perfectly fine to create
// 1 record by providing it to create([ record ]),
// you just can't provide an Object to create().
const record = mutation.createOne({
  // ...state for the record
})

```

## Executing

```javascript
// You can call execute() on either the pluginMutation
// or any of the model mutations. Regardless of
// what you call it on, it will always resolve
// to the plugin mutation.
const pluginMutation = await mutation.execute(true);
if (pluginMutation.isCancelling) {
  console.log("mutation failed");
} else {
  console.log("mutation successful");
}
```

# Session

The SDK will automatically keep a stateful record for each unique visitor, and it is loaded into local state when the SDK is started for the client. Use its `props` field to save any arbitrary data you want, and it will be available to you on the next page load.

You can mutate the `props` Object via a mutation, it's a normal field, but it's a JSON type so its value is an Object.

But there is also a convenience method, `setProps()`, that is identical to `getState()` except it merges the provided Object with the Session's existing `props` Object (or creates it if there are no props set for it yet). Then, it saves the updated `props` Object to the DB.

Example:

```javascript
getVitalStatsPlugin().getSession().setProps({
  myCustomKey: "myCustomValue",
});
```

You can call `getVitalStatsPlugin().getSession().getState()` to see all the values that are available on the Session record, some might be useful to you.

There will be a separate Session record for each client and each unique visitor. Meaning, if you instantiate an SDK for two+ different accounts, they will both have an independent Session record for the visitor.

# Dev Mode

If you instantiate the SDK with `options.isDefault = true` (most likely), there is a developer mode that you can activate to see more details about what's going on, or just look around at the objects available.

Here's how (again, you must instantiate with `options.isDefault = true`):

1. Open devtools and execute `enableDevMode()` in the console
2. It'll load the additional scripts automatically.
3. You can then execute `getAppData()` in the console to view a dump of all the data/state/objects.
