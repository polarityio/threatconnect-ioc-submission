/*
 * Copyright (c) 2023, Polarity.io, Inc.
 */

const fp = require("lodash/fp");

const searchGroups = async (groupName, groupType, options, requestWithDefaults) => {
    await requestWithDefaults({
        path: `v3/groups`,
        method: 'GET',
        qs: {
          tql: `typeName="${groupType}" and name = "${groupName}"`
        },
        options
    });

    fp.getOr(
        [],
        'body.data',

    );
}

module.exports = searchGroups