**@bonsai/event** is a typed implementation of two complementary event systems, inspired by [Backbone.Events](https://github.com/jashkenas/backbone/blob/master/backbone.js?plain=1#L71) and [Backbone.radio](https://github.com/marionettejs/backbone.radio#readme).

It includes two event systems :

- **Events** which is an implementation of Pub/Sub pattern (aka EventEmitter in Node.js)
- **Request** which is a request/reply (aka HTTP communication) pattern.


It provides two ways of event implementation :

## The **Event-in-object way**

  The `EventTrigger` class is the base event emitter class provided by `@bonsai/event`. It provides all the features of the **Events** system with `on`, `listenTo`, `once`, `listenToOnce`, `off`, `stopListening` and `trigger` methods. It is a typed rewrite of [Backbone.Events](https://github.com/jashkenas/backbone/blob/master/backbone.js#L71).

  Let's say that an objectA - a `view` for example - needs to react to events from an objectB - a `model` for example.
  ```
  myView.listenTo(myModel, "change", () => {
    console.log("Something in myModel has changed.");
  });

  // later, this will trigger the callback on myView
  myModel.trigger("change");
  ```

  This is possible **only if the listener has access to the emitter**.

---

## The **Channel way**

  The `Channel` class serves as a third party object to allow independant objects to communicate. It inherits all functionality from `EventTrigger` and also provides all functionality from **Request**: `reply`, `request`. Channels are created and retrieved by the singleton object `Radio`.

  Here is an example:
  ```ts
  // in a User.channel.ts file
  import {
    TEventMap,
    TRequestMap,
    Radio,
    Channel
  } from "@bonsai/event";

  type TUserChannelRequestMap = TRequestMap<{
    users: () => string[] // retrieve all the users
    "is:logged": (name: string) => boolean; //
  }>;

  type TUserChannelEventMap = TEventMap<{
    login: (name: string) => void;
    logout: (name: string) => void;
  }>;
  export const userChannel = Radio.channel("user") as Channel<
    TUserChannelEventMap,
    TUserChannelRequestMap
  >;

  // list of users
  const users = [
    { name: "admin", isLogged: true },
    { name: "anonymous", isLogged: false }
  ];

  // Logic of the channel.

  userChannel.reply("users", () => {
    return users;
  });
  userChannel.reply("is:logged", (username) => {
    const result = users.find((user) => { return username === user.name });
    return result | null;
  });
  userChannel.on("login", (username) => {
    const index = users.findIndex((user) => { return username === user.name });
    if (index > -1) {
      users[index].isLogged = true;
    }
  });
  userChannel.on("logout", (username) => {
    const index = users.findIndex((user) => { return username === user.name });
    if (index > -1) {
      users[index].isLogged = false;
    }
  });



  // in another distant object
  import { userChannel } from "../../User/User.channel.ts"

  // to know if the user 'admin' is logged
  const isAdminLogged = userChannel.request("is:logged", "admin");


  // to make the user 'anonmymous' log in.
  userChannel.trigger("login", "anonymous");

  ```

