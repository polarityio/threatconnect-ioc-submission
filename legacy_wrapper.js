'use strict';
process.chdir(__dirname)

const integration = require('./integration')
const util = require('util')
const bunyan = require('../assets/node_modules/bunyan');
const less = require('../assets/node_modules/less');
const esprima = require('../assets/node_modules/esprima');
const emberTemplateCompiler = require('../assets/node_modules/ember-source/dist/ember-template-compiler');

const maybe_wrap_in_promise = func => {
  return func instanceof Function
  ? util.promisify(func)
  : () => Promise.resolve({error: "api not configured"})
}

const on_message_async = maybe_wrap_in_promise(integration.onMessage)
const on_details_async = maybe_wrap_in_promise(integration.onDetails)
const do_lookup_async = maybe_wrap_in_promise(integration.doLookup)
const validate_options_async = maybe_wrap_in_promise(integration.validateOptions)

const serialize_error = error => {
  let errorObject = typeof error === 'object'? error: Object({detail: error});
    
  return Object.getOwnPropertyNames(errorObject).reduce(
    (acc, prop_name) => {
      acc[prop_name] = errorObject[prop_name];
      return acc
    },
    {}
  );
};

process.on('uncaughtException', function(error) {
  console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
  process.exit(1)
})

const do_startup = logger_config => {
  try {
    const startup_callback = integration.startup(bunyan.createLogger({...logger_config, serializers: bunyan.stdSerializers}))
    return startup_callback instanceof Function
      ? startup_callback(error => {
        if(error) console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
      })
      : startup_callback
  } catch(error) {
    console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
  }
}

/**
 * If we don't catch errors the node program will crash
 * due to the unhandled exception and this will stop the nif from
 * detecting and deserializing the correct promise.
 * So the server uses this file to wrap the API from the integration with
 * try/catch blocks allowing errors to be correctly serialized to stdout
 * so that the Port will detect the message and properly deserialize it into an error that can be
 * broadcasted back to the server. Additionally since the elixer server cannot
 * pass functions to the integration, we have to instantiate the bunyan logger in this file
 * so we can pass it to the integration.
 */
module.exports = {
  startup: async(logger_config) => {
    if (integration.startup) {
      do_startup(logger_config)
    } else {
      return {error: "api not configured"}
    }
  },
  doLookup: async(entities, options) => {
    try {
      return await do_lookup_async(entities, options)
    } catch(error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  onMessage: async(payload, options) => {
    try {
      return await on_message_async(payload, options)
    } catch (error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  onDetails: async (lookup_object, options) => {
    try {
      return await on_details_async(lookup_object, options)
    } catch (error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  hasOnDetails: async () => {
    try {
      return await typeof integration.onDetails === 'function'
    } catch (error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  validateOptions: async(user_options) => {
    try {
      return await validate_options_async(user_options)
    } catch(error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  render_css: async(less_binary, options) => {
    try {
      return await less.render(less_binary, options)
    } catch(error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  parse_javascript: async(js_binary, options) => {
    try {
      return esprima.parse(js_binary, options)
    } catch(error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  },
  precompile_ember_template: async(js_binary) => {
    try {
      return emberTemplateCompiler.precompile(js_binary)
    } catch(error) {
      console.log(`__elixirnodejs__UOSBsDUP6bp9IF5__${JSON.stringify([false, serialize_error(error)])}`)
    }
  }
};
