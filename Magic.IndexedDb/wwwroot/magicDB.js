window.magicBlazorDB = {
    databases: [],
    createDb: function (dotnetReference, transaction, dbStore) {
        if (window.magicBlazorDB.databases.find(d => d.name == dbStore.name) !== undefined)
            console.warn("Blazor.IndexedDB.Framework - Database already exists");

        var db = new Dexie(dbStore.name);

        var stores = {};
        for (var i = 0; i < dbStore.storeSchemas.length; i++) {
            // build string
            var schema = dbStore.storeSchemas[i];
            var def = "";
            if (schema.primaryKeyAuto)
                def = def + "++";
            if (schema.primaryKey !== null && schema.primaryKey !== "")
                def = def + schema.primaryKey;
            if (schema.uniqueIndexes !== undefined) {
                for (var j = 0; j < schema.uniqueIndexes.length; j++) {
                    def = def + ",";
                    var u = "&" + schema.uniqueIndexes[j];
                    def = def + u;
                }
            }
            if (schema.indexes !== undefined) {
                for (var j = 0; j < schema.indexes.length; j++) {
                    def = def + ",";
                    var u = schema.indexes[j];
                    def = def + u;
                }
            }
            stores[schema.name] = def;
        }
        db.version(dbStore.version).stores(stores);
        if (window.magicBlazorDB.databases.find(d => d.name == dbStore.name) !== undefined) {
            window.magicBlazorDB.databases.find(d => d.name == dbStore.name).db = db;
        } else {
            window.magicBlazorDB.databases.push({
                name: dbStore.name,
                db: db
            });
        }
        db.open().then(_ => {
            dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Database opened');
        }).catch(e => {
            console.error(e);
            dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Database could not be opened');
        });
    },
    deleteDb: function (dotnetReference, transaction, dbName) {
        window.magicBlazorDB.getDb(dbName).then(db => {
            var index = window.magicBlazorDB.databases.findIndex(d => d.name == dbName);
            window.magicBlazorDB.databases.splice(index, 1);
            db.delete().then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Database deleted');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Database could not be deleted');
            });
        });
    },
    addItem: function (dotnetReference, transaction, item) {
        window.magicBlazorDB.getTable(item.dbName, item.storeName).then(table => {
            table.add(item.record).then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Item added');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Item could not be added');
            });
        });
    },
    bulkAddItem: function (dotnetReference, transaction, dbName, storeName, items) {
        window.magicBlazorDB.getTable(dbName, storeName).then(table => {
            console.log(items);
            table.bulkAdd(items).then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Item(s) bulk added');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Item(s) could not be bulk added');
            });
        });
    },
    putItem: function (dotnetReference, transaction, item) {
        window.magicBlazorDB.getTable(item.dbName, item.storeName).then(table => {
            table.put(item.record).then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Item put successful');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Item put failed');
            });
        });
    },
    updateItem: function (dotnetReference, transaction, item) {
        window.magicBlazorDB.getTable(item.dbName, item.storeName).then(table => {
            table.update(item.key, item.record).then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Item updated');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Item could not be updated');
            });
        });
    },
    bulkUpdateItem: function (dotnetReference, transaction, items) {
        return new Promise(async (resolve, reject) => {
            try {
                const table = await window.magicBlazorDB.getTable(items[0].dbName, items[0].storeName);
                let updatedCount = 0;
                let errors = false;

                for (const item of items) {
                    try {
                        await table.update(item.key, item.record);
                        updatedCount++;
                    } catch (e) {
                        console.error(e);
                        errors = true;
                    }
                }

                if (errors) {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Some items could not be updated');
                    reject(new Error('Some items could not be updated'));
                } else {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, `${updatedCount} items updated`);
                    resolve(updatedCount);
                }
            } catch (e) {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Items could not be updated');
                reject(e);
            }
        });

        // Proper bulk update isn't added yet in the currvent V3
        //window.magicBlazorDB.getTable(items[0].dbName, items[0].storeName).then(table => {
        //    const updates = items.map(item => ({
        //        key: item.key,
        //        changes: item.record
        //    }));

        //    table.bulkUpdate(updates).then(updatedCount => {
        //        dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, `${updatedCount} items updated`);
        //    }).catch(e => {
        //        console.error(e);
        //        dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Items could not be updated');
        //    });
        //});
    },
    bulkDelete: function (dotnetReference, transaction, dbName, storeName, keys) {
        return new Promise(async (resolve, reject) => {
            try {
                const table = await window.magicBlazorDB.getTable(dbName, storeName);
                let deletedCount = 0;
                let errors = false;

                for (const key of keys) {
                    try {
                        await table.delete(key);
                        deletedCount++;
                    } catch (e) {
                        console.error(e);
                        errors = true;
                    }
                }

                if (errors) {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Some items could not be deleted');
                    reject(new Error('Some items could not be deleted'));
                } else {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, `${deletedCount} items deleted`);
                    resolve(deletedCount);
                }
            } catch (e) {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Items could not be deleted');
                reject(e);
            }
        });
    },
    deleteItem: function (dotnetReference, transaction, item) {
        window.magicBlazorDB.getTable(item.dbName, item.storeName).then(table => {
            table.delete(item.key).then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Item deleted');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Item could not be deleted');
            });
        });
    },
    clear: function (dotnetReference, transaction, dbName, storeName) {
        window.magicBlazorDB.getTable(dbName, storeName).then(table => {
            table.clear().then(_ => {
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Table cleared');
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Table could not be cleared');
            });
        });
    },
    findItem: function (dotnetReference, transaction, item) {
        var promise = new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(item.dbName, item.storeName).then(table => {
                table.get(item.key).then(i => {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Found item');
                    resolve(i);
                }).catch(e => {
                    console.error(e);
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Could not find item');
                    reject(e);
                });
            });
        });
        return promise;
    },
    findItemv2: function (dotnetReference, transaction, dbName, storeName, keyValue) {
        var promise = new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(dbName, storeName).then(table => {
                table.get(keyValue).then(i => {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'Found item');
                    resolve(i);
                }).catch(e => {
                    console.error(e);
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'Could not find item');
                    reject(e);
                });
            });
        });
        return promise;
    },
    toArray: function (dotnetReference, transaction, dbName, storeName) {
        return new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(dbName, storeName).then(table => {
                table.toArray(items => {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'toArray succeeded');
                    resolve(items);
                }).catch(e => {
                    console.error(e);
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'toArray failed');
                    reject(e);
                });
            });
        });
    },
    getDb: function (dbName) {
        return new Promise((resolve, reject) => {
            if (window.magicBlazorDB.databases.find(d => d.name == dbName) === undefined) {
                console.warn("Blazor.IndexedDB.Framework - Database doesn't exist");
                var db1 = new Dexie(dbName);
                db1.open().then(function (db) {
                    if (window.magicBlazorDB.databases.find(d => d.name == dbName) !== undefined) {
                        window.magicBlazorDB.databases.find(d => d.name == dbName).db = db1;
                    } else {
                        window.magicBlazorDB.databases.push({
                            name: dbName,
                            db: db1
                        });
                    }
                    resolve(db1);
                }).catch('NoSuchDatabaseError', function (e) {
                    // Database with that name did not exist
                    console.error("Database not found");
                    reject("No database");
                });
            } else {
                var db = window.magicBlazorDB.databases.find(d => d.name == dbName).db;
                resolve(db);
            }
        });
    },
    getTable: function (dbName, storeName) {
        return new Promise((resolve, reject) => {
            window.magicBlazorDB.getDb(dbName).then(db => {
                var table = db.table(storeName);
                resolve(table);
            });
        });
    },
    createFilterObject: function (filters) {
        const jsonFilter = {};
        for (const filter in filters) {
            if (filters.hasOwnProperty(filter))
                jsonFilter[filters[filter].indexName] = filters[filter].filterValue;
        }
        return jsonFilter;
    },
    where: function (dotnetReference, transaction, dbName, storeName, filters) {
        const filterObject = this.createFilterObject(filters);
        return new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(dbName, storeName).then(table => {
                table.where(filterObject).toArray(items => {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'where succeeded');
                    resolve(items);
                })
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'where failed');
                reject(e);
            });
        });
    },
    wherev2: function (dotnetReference, transaction, dbName, storeName, jsonQueries, jsonQueryAdditions) {
        const orConditionsArray = jsonQueries.map(query => JSON.parse(query));
        const QueryAdditions = JSON.parse(jsonQueryAdditions);

        return new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(dbName, storeName).then(table => {
                let combinedQuery;

                function applyConditions(conditions) {

                    let dexieQuery;

                    for (let i = 0; i < conditions.length; i++) {
                        const condition = conditions[i];
                        const parsedValue = condition.isString ? condition.value : parseInt(condition.value);

                        switch (condition.operation) {
                            case 'GreaterThan':
                                if (!dexieQuery) {
                                    dexieQuery = table.where(condition.property).above(parsedValue);
                                } else {
                                    dexieQuery = dexieQuery.and(item => item[condition.property] > parsedValue);
                                }
                                break;
                            case 'GreaterThanOrEqual':
                                if (!dexieQuery) {
                                    dexieQuery = table.where(condition.property).aboveOrEqual(parsedValue);
                                } else {
                                    dexieQuery = dexieQuery.and(item => item[condition.property] >= parsedValue);
                                }
                                break;
                            case 'LessThan':
                                if (!dexieQuery) {
                                    dexieQuery = table.where(condition.property).below(parsedValue);
                                } else {
                                    dexieQuery = dexieQuery.and(item => item[condition.property] < parsedValue);
                                }
                                break;
                            case 'LessThanOrEqual':
                                if (!dexieQuery) {
                                    dexieQuery = table.where(condition.property).belowOrEqual(parsedValue);
                                } else {
                                    dexieQuery = dexieQuery.and(item => item[condition.property] <= parsedValue);
                                }
                                break;
                            case 'Equal':
                                if (!dexieQuery) {
                                    if (condition.isString) {
                                        if (condition.caseSensitive) {
                                            dexieQuery = table.where(condition.property).equals(condition.value);
                                        } else {
                                            dexieQuery = table.where(condition.property).equalsIgnoreCase(condition.value);
                                        }
                                    } else {
                                        dexieQuery = table.where(condition.property).equals(parsedValue);
                                    }
                                } else {
                                    if (condition.isString) {
                                        if (condition.caseSensitive) {
                                            dexieQuery = dexieQuery.and(item => item[condition.property] === condition.value);
                                        } else {
                                            dexieQuery = dexieQuery.and(item => item[condition.property].toLowerCase() === condition.value.toLowerCase());
                                        }
                                    } else {
                                        dexieQuery = dexieQuery.and(item => item[condition.property] === parsedValue);
                                    }
                                }
                                break;
                            case 'NotEqual':
                                if (!dexieQuery) {
                                    if (condition.isString) {
                                        if (condition.caseSensitive) {
                                            dexieQuery = table.where(condition.property).notEqual(condition.value);
                                        } else {
                                            dexieQuery = table.where(condition.property).notEqualIgnoreCase(condition.value);
                                        }
                                    } else {
                                        dexieQuery = table.where(condition.property).notEqual(parsedValue);
                                    }
                                } else {
                                    if (condition.isString) {
                                        if (condition.caseSensitive) {
                                            dexieQuery = dexieQuery.and(item => item[condition.property] !== condition.value);
                                        } else {
                                            dexieQuery = dexieQuery.and(item => item[condition.property].toLowerCase() !== condition.value.toLowerCase());
                                        }
                                    } else {
                                        dexieQuery = dexieQuery.and(item => item[condition.property] !== parsedValue);
                                    }
                                }
                                break;
                            case 'Contains':
                                if (!dexieQuery) {
                                    if (condition.caseSensitive) {
                                        dexieQuery = table.where(condition.property).filter(item => item[condition.property].includes(condition.value));
                                    } else {
                                        dexieQuery = table.where(condition.property).filter(item => item[condition.property].toLowerCase().includes(condition.value.toLowerCase()));
                                    }
                                } else {
                                    if (condition.caseSensitive) {
                                        dexieQuery = dexieQuery.and(item => item[condition.property].includes(condition.value));
                                    } else {
                                        dexieQuery = dexieQuery.and(item => item[condition.property].toLowerCase().includes(condition.value.toLowerCase()));
                                    }
                                }
                                break;
                            case 'StartsWith':
                                if (!dexieQuery) {
                                    if (condition.caseSensitive) {
                                        dexieQuery = table.where(condition.property).startsWith(condition.value);
                                    } else {
                                        dexieQuery = table.where(condition.property).startsWithIgnoreCase(condition.value);
                                    }
                                } else {
                                    if (condition.caseSensitive) {
                                        dexieQuery = dexieQuery.and(item => item[condition.property].startsWith(condition.value));
                                    } else {
                                        dexieQuery = dexieQuery.and(item => item[condition.property].toLowerCase().startsWith(condition.value.toLowerCase()));
                                    }
                                }
                                break;
                            case 'StringEquals':
                                if (!dexieQuery) {
                                    if (condition.caseSensitive) {
                                        dexieQuery = table.where(condition.property).equals(condition.value);
                                    } else {
                                        dexieQuery = table.where(condition.property).equalsIgnoreCase(condition.value);
                                    }
                                } else {
                                    if (condition.caseSensitive) {
                                        dexieQuery = dexieQuery.and(item => item[condition.property] === condition.value);
                                    } else {
                                        dexieQuery = dexieQuery.and(item => item[condition.property].toLowerCase() === condition.value.toLowerCase());
                                    }
                                }
                                break;

                            default:
                                console.error('Unsupported operation:', condition.operation);
                                reject(new Error('Unsupported operation: ' + condition.operation));
                                return;
                        }
                    }

                    return dexieQuery;

                }


                function applyQueryAdditions(dexieQuery, queryAdditions) {
                    if (queryAdditions != null) {
                        for (let i = 0; i < queryAdditions.length; i++) {
                            const queryAddition = queryAdditions[i];

                            switch (queryAddition.Name) {
                                case 'skip':
                                    dexieQuery = dexieQuery.offset(queryAddition.IntValue);
                                    break;
                                case 'take':
                                    dexieQuery = dexieQuery.limit(queryAddition.IntValue);
                                    break;
                                case 'takeLast':
                                    dexieQuery = dexieQuery.reverse().limit(queryAddition.IntValue);
                                    break;
                                //case 'orderBy': // Not currently available in Dexie version 1,2, or 3
                                //    dexieQuery = dexieQuery.sortBy(queryAddition.StringValue);
                                //    break;
                                //case 'orderByDescending': // Not currently available in Dexie version 1,2, or 3
                                //    dexieQuery = dexieQuery.reverse().sortBy(queryAddition.StringValue);
                                //    break;
                                case 'reverse':
                                    dexieQuery = dexieQuery.reverse();
                                    break;
                                //case 'first': // not working
                                //    dexieQuery = dexieQuery.first();
                                //    break;
                                //case 'last': // not working
                                //    dexieQuery = dexieQuery.last();
                                //    break;
                                default:
                                    console.error('Unsupported query addition:', queryAddition.Name);
                                    break;
                            }
                        }
                    }
                    return dexieQuery;
                }

                function applyArrayQueryAdditions(results, queryAdditions) {
                    if (queryAdditions != null) {
                        for (let i = 0; i < queryAdditions.length; i++) {
                            const queryAddition = queryAdditions[i];

                            switch (queryAddition.Name) {
                                case 'skip':
                                    results = results.slice(queryAddition.IntValue);
                                    break;
                                case 'take':
                                    results = results.slice(0, queryAddition.IntValue);
                                    break;
                                case 'takeLast':
                                    results = results.slice(-queryAddition.IntValue).reverse();
                                    break;
                                case 'orderBy':
                                    results = results.sort((a, b) => a[queryAddition.StringValue] - b[queryAddition.StringValue]);
                                    break;
                                case 'orderByDescending':
                                    results = results.sort((a, b) => b[queryAddition.StringValue] - a[queryAddition.StringValue]);
                                    break;
                                default:
                                    console.error('Unsupported query addition for array:', queryAddition.Name);
                                    break;
                            }
                        }
                    }
                    return results;
                }

                async function combineQueries() {
                    const allQueries = [];

                    for (const conditions of orConditionsArray) {
                        const andQuery = applyConditions(conditions[0]);
                        if (andQuery) {
                            allQueries.push(andQuery);
                        }
                    }

                    if (allQueries.length > 0) {
                        // Use Dexie.Promise.all to resolve all toArray promises
                        const allResults = await Dexie.Promise.all(allQueries.map(query => query.toArray()));

                        // Combine all the results into one array
                        let combinedResults = [].concat(...allResults);

                        // Apply query additions to the combined results
                        combinedResults = applyArrayQueryAdditions(combinedResults, QueryAdditions);

                        dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'where succeeded');
                        resolve(combinedResults);
                    } else {
                        dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'where succeeded');
                        resolve([]);
                    }
                }




                (async () => { // Add an async IIFE to handle the promise
                    if (orConditionsArray.length > 0) {
                        await combineQueries(); // Add 'await' here
                    } else {
                        dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'where succeeded');
                        resolve([]);
                    }
                })().catch(e => { // Add error handling for the async IIFE
                    console.error(e);
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'where failed');
                    reject(e);
                });
            }).catch(e => {
                console.error(e);
                dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'where failed');
                reject(e);
            });
        });
    },
    getAll: function (dotnetReference, transaction, dbName, storeName) {
        return new Promise((resolve, reject) => {
            window.magicBlazorDB.getTable(dbName, storeName).then(table => {
                table.toArray().then(items => {
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, false, 'getAll succeeded');
                    resolve(items);
                }).catch(e => {
                    console.error(e);
                    dotnetReference.invokeMethodAsync('BlazorDBCallback', transaction, true, 'getAll failed');
                    reject(e);
                });
            });
        });
    }
}

function encryptString(data, key) {
    // Convert the data to an ArrayBuffer
    let dataBuffer = new TextEncoder().encode(data).buffer;

    // Generate a random initialization vector
    let iv = crypto.getRandomValues(new Uint8Array(16));

    // Convert the key to an ArrayBuffer
    let keyBuffer = new TextEncoder().encode(key).buffer;

    // Create a CryptoKey object from the key buffer
    return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-CBC' }, false, ['encrypt'])
        .then(key => {
            // Encrypt the data with AES-CBC encryption
            return crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, dataBuffer);
        })
        .then(encryptedDataBuffer => {
            // Concatenate the initialization vector and encrypted data
            let encryptedData = new Uint8Array(encryptedDataBuffer);
            let encryptedDataWithIV = new Uint8Array(encryptedData.byteLength + iv.byteLength);
            encryptedDataWithIV.set(iv);
            encryptedDataWithIV.set(encryptedData, iv.byteLength);

            // Convert the encrypted data to a base64 string and return it
            return btoa(String.fromCharCode.apply(null, encryptedDataWithIV));
        });
}

function decryptString(encryptedData, key) {
    // Convert the base64 string to a Uint8Array
    let encryptedDataWithIV = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    let iv = encryptedDataWithIV.slice(0, 16);
    let data = encryptedDataWithIV.slice(16);

    // Convert the key to an ArrayBuffer
    let keyBuffer = new TextEncoder().encode(key).buffer;

    // Create a CryptoKey object from the key buffer
    return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-CBC' }, false, ['decrypt'])
        .then(key => {
            // Decrypt the data with AES-CBC decryption
            return crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, data);
        })
        .then(decryptedDataBuffer => {
            // Convert the decrypted data to a string and return it
            return new TextDecoder().decode(decryptedDataBuffer);
        });
}