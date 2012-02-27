(function () {
// Global object.
  var exports = this;

// Code Object
// This object is what manipulates the code that's passed
// to be fixed.
  var Code = function (src) {
    this.src = src.split("\n");
  };

// Retrieves the code that was stored in the Object
//
// returns String
  Code.prototype.getCode = function () {
    return this.src.join("\n");
  };

// The fix method fixes a certain line in the code.
//
// **fn** is the function which will be responsible for modifying the line
// **o** is the JSHint object related to the error we're fixing
//
// returns the fixed line as a String
  Code.prototype.fix = function (fn, o) {
    var line = o.line;
    return (this.src[line] = fn.call(fn, this.src[line], o, this));
  };

// This function keeps track of character changes.
// As the code is modified via additions/deletions
// the character positioning reported by JSHint is no
// longer 100% accurate. This function will return the
// position where the intended character is at.
//
// **r** is the JSHint object related to the error
//
// returns Number
//
// Tabs are special, they count as two characters in text
// and as one character by the JSHint parser.
// If there are tabs then indentation is important, we'll need to know
// how many characters each tab is supposed to be worth.
  Code.prototype.getChr = function (r) {
    var lineNo = r.line;
    var tabs = this.src[lineNo].split("\t");

    return r.character - ((tabs.length - 1) * (r.config.indent - 1)) - 1;
  };


// Fix Object
// Contains all the methods that fix the various errors
  var fix = (function () {

// These are helpers that a few of the errors share in common
    var helpers = {

// Inserts a string within a string at a certain offset.
//
// **str** is the initial string
// **offset** is a number where we'll be inserting
// **newstr** is the string that will be inserted
//
// returns the modified String
      insertIntoString: function (str, offset, newstr) {
        var part1 = str.substr(0, offset);
        var part2 = str.substr(offset);

        return part1 + newstr + part2;
      },

// Removes a certain character from the string
//
// **str** is the string
// **pos** is the position in the string we'll be removing
//
// returns the modified String
      rmFromString: function (str, pos) {
        return str.slice(0, pos) + "".substr(0, 1) + "".slice(1) + str.slice(pos + 1);
      }
    };

// The following are the methods that make the fixes.
// Each method is responsible for fixing one error.
//
// All methods have the same parameters
// **str** is the string to fix
// **o** is the JSHint object which holds the error information
// **code** is the current Code object
//
// returns String
    var Fix = {

// Adds a semicolon at the position specified by JSHint.
//
// For those that prefer to end their statements with
// a semicolon fixmyjs will automatically insert a semicolon
// wherever one is thought to be missing.
//
// Example:
//
// `var foo = 1` -> `var foo = 1;`
      addSemicolon: function (str, o, code) {
        var chr = code.getChr(o);
        return helpers.insertIntoString(str, chr, ";");
      },

// Adds a space at the position specified by JSHint.
//
// Related to the `white` option in JSHint. It is
// meant for beautifying code and adds spaces where
// spaces are supposed to be according to certain
// authorities of the language.
//
// Example:
//
// `var a = function(){}` -> `var a = function () {}`
      addSpace: function (str, o, code) {
        var chr = code.getChr(o);
        return helpers.insertIntoString(str, chr, " ");
      },

// If a var is already defined, `shadow`, then we remove the var.
//
// Example:
//
// `var a = 1; var a = 2;` -> `var a = 1; a = 2`
      alreadyDefined: function (str, o) {
        var a = o.a;
        var rx = new RegExp("(.*)(var " + a + ")");
        var exec = "";
        var incorrect = "";
        var replacement = "";

        if (rx.test(str)) {
          exec = rx.exec(str);
          incorrect = str.replace(exec[1], "");
          replacement = incorrect.replace(exec[2], a);
        }

        return str.replace(incorrect, replacement);
      },

// Converts assignments from Object to Literal form.
//+ arrayLiteral :: String -> String
      arrayLiteral: function (str) {
        return str.replace("new Array()", "[]");
      },

// Converts from square bracket notation to dot notation.
//
// Example:
//
// `person['name']` -> `person.name`
      dotNotation: function (str, o) {
        var dot = o.a;
        var rx = new RegExp("\\[[\"']" + dot + "[\"']\\]");
        var sqbNotation;

        if (rx.test(str)) {
          sqbNotation = rx.exec(str);
          str = str.replace(sqbNotation[0], "." + dot);
        }

        return str;
      },

// Immediate functions are executed within the parenthesis.
//
// By wrapping immediate functions in parenthesis you indicate
// that the expression is the result of a function and not the
// function itself.
//+ immed :: String -> String
      immed: function (str) {
        var rx = /\)\((.*)\);/;
        var params;

        if (rx.test(str)) {
          params = rx.exec(str);
          str = str.replace(params[0], "(" + params[1] + "));");
        }

        return str;
      },

// Auto-indents. Based on your preferences of `spaces`
// or `tabs`.
//
// fixmyjs will not automatically indent your code unless
// you have the `indentpref` option set to your preference
// and `auto_indent` is set to true in your `.jshintrc` file.
//
// You may also want to configure the `indent` option to the
// desired amount of characters you wish to indent. The default
// set by JSHint is four.
      indent: function (str, o) {
        var indent = o.b;
        var config = o.config;
        var ident;
        if (config.auto_indent === true && config.indentpref) {
          if (config.indentpref === "spaces") {
            str = new Array(indent).join(" ") + str.trim();
          } else if (config.indentpref === "tabs") {
            ident = (indent + 1) / config.indent;
            if (ident > 0) {
              str = new Array(ident).join("\t") + str.trim();
            }
          }
        }

        return str;
      },

// Adds parens to constructors missing them during invocation.
//+ invokeConstructor :: String -> String
      invokeConstructor: function (str) {
        var rx = /new [a-zA-Z_$][0-9a-zA-Z_$]*\(/g;
        var result = str;

        function addInvocation(tmp) {
          var rx = /new ([a-zA-Z_$][0-9a-zA-Z_$]*)/;
          var res;

          if (rx.test(tmp)) {
            res = rx.exec(tmp).shift();
            str = str.replace(res, res + "()");
          }

          return str;
        }

        if (rx.test(str)) {
          result = str.replace(rx, "");
        }

        return addInvocation(result);
      },

// Adds a zero when there is a leading decimal.
//
// A leading decimal can be confusing if there isn't a
// zero in front of it since the dot is used for calling
// methods of an object. Plus it's easy to miss the dot.
//
// Example:
//
// `.5` -> `0.5`
//+ leadingDecimal :: String -> String
      leadingDecimal: function (str) {
        var rx = /([\D])(\.[0-9]*)/;

        var result;

        if (rx.test(str)) {
          result = rx.exec(str);
          str = str.replace(rx, result[1] + "0" + result[2]);
        }

        return str;
      },

// Removes spaces or tabs (depending on preference) when
// both are present on the same line.
//+ mixedSpacesAndTabs :: String -> { config: { indentpref: String, indent: Number } } -> String
      mixedSpacesNTabs: function (str, o) {
        var config = o.config;
        var spaces;
        if (config.indentpref) {
          spaces = new Array(config.indent + 1).join(" ");

          if (config.indentpref === "spaces") {
            str = str.replace(/\t/g, spaces);
          } else if (config.indentpref === "tabs") {
            str = str.replace(new RegExp(spaces, "g"), "\t");
          }
        }

        return str;
      },

// You shouldn't delete vars. This will remove the delete statement
// and instead set the variable to undefined.
//
// Example: `delete foo;` -> `foo = undefined;`
//+ noDeleteVar :: String -> String
      noDeleteVar: function (str) {
        var rx = /delete ([a-zA-Z_$][0-9a-zA-Z_$]*)/;
        var exec;
        if (rx.test(str)) {
          exec = rx.exec(str);
          str = str.replace(exec[0], exec[1] + " = undefined");
        }
        return str;
      },

// Removes `new` when it's used as a statement.
// Only works if option `nonew` is set to true.
//
// Example: `new Ajax()` -> `Ajax()`
//+ noNew :: String -> String
      noNew: function (str) {
        var rx = /new ([a-zA-Z_$][0-9a-zA-Z_$]*)/;
        var exec;
        var rmnew = "";
        if (rx.test(str)) {
          exec = rx.exec(str);
          rmnew = exec[0].replace("new ", "");
          str = str.replace(exec[0], rmnew);
        }
        return str;
      },

// Converts assignments from Object to Literal form.
//+ objectLiteral :: String -> String
      objectLiteral: function (str) {
        return str.replace("new Object()", "{}");
      },

// Removes `new` when attempting to use a function not meant to
// be a constructor.
//
// Uses RegEx to determine where the error occurs. If there's a match
// then we extract the 1st and 2nd value of the result of the RegExp
// execution, and use them in String replace.
//
// Example: `new Number(16)` -> `Number(16)`
//+ objNoConstruct :: String -> String
      objNoConstruct: function (str) {
        var rx = /new (Number|String|Boolean|Math|JSON)/;
        var exec;
        if (rx.test(str)) {
          exec = rx.exec(str);
          str = str.replace(exec[0], exec[1]);
        }
        return str;
      },

// Uses isNaN function rather than comparing to NaN.
//
// It's the same reason you shouldn't compare with undefined.
// NaN can be redefined. Although comparing to NaN is faster
// than using the isNaN function.
//+ useIsNaN :: String -> String
      useIsNaN: function (str) {
        var rx = /([a-zA-Z_$][0-9a-zA-Z_$]*)( )*(=|!)(=|==)( )*NaN/;
        var exec;

        if (rx.test(str)) {
          exec = rx.exec(str);

          if (exec) {
            str = str.replace(exec[0], (exec[3] === "!" ? "!": "") + "isNaN(" + exec[1] + ")");
          }
        }

        return str;
      },

// Adds radix parameter to parseInt statements.
//
// Although this parameter is optional, it's good practice
// to add it so that the function won't assume the number is
// octal.
//
// In the example below we have a sample Credit Card security
// code which is padded by a zero. By adding the radix parameter
// we are telling the compiler the base of the number is being
// passed.
//
// Example:
//
// `parseInt('0420')` -> `parseInt('0420', 10)`
//+ radix :: String -> String
      radix: function (str) {
        var rx = /parseInt\((.*)\)/;
        var exec;

        if (rx.test(str)) {
          exec = rx.exec(str);

          str = str.replace(exec[0], "parseInt(" + exec[1] + ", 10)");
        }

        return str;
      },

// Removes a Character from the String
      rmChar: function (str, o, code) {
        var chr = code.getChr(o);
        return helpers.rmFromString(str, chr);
      },

// Removes debugger statements.
//
// Debugger statements can be useful for debugging
// but some browsers don't support them so they shouldn't
// be in production.
//+ rmDebugger :: String
      rmDebugger: function () {
        return "";
      },

// Removes undefined when variables are initialized to it.
//
// It's not necessary to initialize variables to undefined since
// they are already initialized to undefined by declaring them.
//
// Example:
//
// `var foo = undefined;` -> `var foo;`
//+ rmUndefined :: String -> String
      rmUndefined: function (str) {
        return str.replace(/( )*=( )*undefined/, "");
      },

// Removes any whitespace at the end of the line.
// Trailing whitespace sucks. It must die.
//+ rmTrailingWhitespace :: String -> String
      rmTrailingWhitespace: function (str) {
        return str.replace(/\s+$/g, "");
      },

// Throws an error that too many errors were reported by JSHint.
// JSHint has a maximum amount of errors it can handle before it barfs.
// If we encounter this, we just throw and recommend that the applications
// that use `fixmyjs` catch the error and either retry to fix the file or
// ask the user what they would like to do.
//
// NOTE: In cases where there are many errors in the file the `TME` error
// may be encountered and none of the errors reported are supported by fixmyjs
// see: GH-31
      tme: function () {
        throw new Error("Too many errors reported by JSHint.");
      },

// Removes a trailing decimal where it's not necessary.
//
// Example:
//
// `12.` -> `12`
//+ trailingDecimal :: String -> String
      trailingDecimal: function (str) {
        var rx = /([0-9]*)\.(\D)/;
        var result;

        if (rx.test(str)) {
          result = rx.exec(str);
          str = str.replace(rx, result[1] + result[2]);
        }

        return str;
      },

// Wraps RegularExpression literals in parenthesis to
// disambiguate the slash operator.
//
// Example: `return /hello/;` -> `return (/hello/);`
//+ wrapRegExp :: String -> String
      wrapRegExp: function (str) {
        var rx = /\/(.*)\/\w?/;
        var result;

        if (rx.test(str)) {
          result = rx.exec(str);
          str = str.replace(rx, "(" + result[0] + ")");
        }

        return str;
      }
    };

    return Fix;
  }());


// The errors Object
  var errors = {};

// DSL to generate the error fixing function.
// First we apply the error to `errors` Object
// Next, we set the priority which determines in which order
// the error will be fixed.
// Last, we pass the function responsible for fixing the error
// along with the Object containing the error's details.
  function w(priority, err, fn) {
    errors[err] = {
      priority: priority,
      fix: function (r, code) {
        return code.fix(fn, r);
      }
    };
  }

// All errors supported by fixmyjs.
// **priority** Is the order in which the error will be fixed, lower is sooner.
// **error** is a string describing the raw input of the error.
// **fn** is the function which handles the fixing.
  w(0, "Extra comma.",                                                            fix.rmChar);
  w(0, "Missing semicolon.",                                                      fix.addSemicolon);
  w(0, "Missing space after '{a}'.",                                              fix.addSpace);
  w(0, "Unexpected space after '{a}'.",                                           fix.rmChar);
  w(0, "Unnecessary semicolon.",                                                  fix.rmChar);
  w(1, "'{a}' is already defined.",                                               fix.alreadyDefined);
  w(1, "['{a}'] is better written in dot notation.",                              fix.dotNotation);
  w(1, "A leading decimal point can be confused with a dot: '.{a}'.",             fix.leadingDecimal);
  w(1, "A trailing decimal point can be confused with a dot '{a}'.",              fix.trailingDecimal);
  w(1, "All 'debugger' statements should be removed.",                            fix.rmDebugger);
  w(1, "Do not use {a} as a constructor.",                                        fix.objNoConstruct);
  w(1, "Do not use 'new' for side effects.",                                      fix.noNew);
  w(1, "Expected '{a}' to have an indentation at {b} instead at {c}.",            fix.indent);
  w(1, "It is not necessary to initialize '{a}' to 'undefined'.",                 fix.rmUndefined);
  w(1, "Missing '()' invoking a constructor.",                                    fix.invokeConstructor);
  w(1, "Missing radix parameter.",                                                fix.radix);
  w(1, "Mixed spaces and tabs.",                                                  fix.mixedSpacesNTabs);
  w(1, "Move the invocation into the parens that contain the function.",          fix.immed);
  w(1, "Trailing whitespace.",                                                    fix.rmTrailingWhitespace);
  w(1, "Use the isNaN function to compare with NaN.",                             fix.useIsNaN);
  w(1, "Use the array literal notation [].",                                      fix.arrayLiteral);
  w(1, "Use the object literal notation {}.",                                     fix.objectLiteral);
  w(1, "Variables should not be deleted.",                                        fix.noDeleteVar);
  w(1, "Wrap the /regexp/ literal in parens to disambiguate the slash operator.", fix.wrapRegExp);
  w(2, "Too many errors.",                                                        fix.tme);


// fixMyJS is part of the global object
  exports.fixMyJS = (function () {
// Copies over the results into one of our own objects
// we decrement r.line by one becuse Arrays start at 0.
// and we pass the config object to r.
    function copyResults(result, config) {
      var r = {};
      Object.keys(result).forEach(function (key) {
        r[key] = result[key];
      });
      r.line -= 1;
      r.config = config;
      return r;
    }

// Calls the function responsible for fixing the error passed.
    function fixError(r, code) {
      errors[r.raw].fix(r, code);
    }

// Function used in forEach which fixes all errors passed
// **code** is the Code object
// **config** is the config object
// returns a function which when iterated it copies over the results
// so we can mutate data later and then call fixError.
    function fixErrors(code, config) {
      return function (result) {
        var r = copyResults(result, config);
        fixError(r, code);
      };
    }

// Used by fixMyJS function in order to sort the
// errors in descending order by priority.
// The logic is that if the priority matches
// then we check the line, if that matches
// we check the character and return in descending order.
    function byPriority(a, b) {
      var p1 = errors[a.raw].priority;
      var p2 = errors[b.raw].priority;

      if (p1 === p2) {
        if (a.line === b.line) {
          return b.character - a.character;
        } else {
          return b.line - a.line;
        }
      } else {
        return p1 - p2;
      }
    }

// The fixMyJS function is what's returned to the
// global object.
//
// **data** is the data from jshint.data()
// **src** is the original src passed to JSHint
//
// returns an Object containing the API
    function fixMyJS(data, src) {
      var code = new Code(src);
      var warnings = data.errors || [];
      var results = [];
      var allErrors = [];
      var config = data.options || {};
      var dupes = {};
      var current = 0;

// Filter out errors we don't support.
// If the error is null then we immediately return false
// Then we check for duplicate errors. Sometimes JSHint will complain
// about the same thing twice. This is a safeguard.
// Otherwise we return true if we support this error.
      warnings.forEach(function (v) {
        if (!v) {
          return false;
        }

        var err = "line" + v.line + "char" + v.character + "reason" + v.reason;

        if (dupes.hasOwnProperty(err)) {
          return false;
        }
        dupes[err] = v;
        
        v.fixable = errors.hasOwnProperty(v.raw);

        if (v.fixable) {
          results.push(v);
          var r = copyResults(v, config);          
          v.fix=errors[v.raw].fix(r, code);
        }

        allErrors.push(v);
      });

// sorts errors by priority.
      results.sort(byPriority);


// fixMyJS API
//
// * getErrors
// * getAllErrors
// * getUnsupportedErrors
// * getCode
// * getConfig
// * next
//   * fix
//   * getDetails
// * run
      var api = {
// returns are supported errors that can be fixed.
        getErrors: function () {
          return results.slice(0);
        },

        getAllErrors: function () {
          return allErrors.slice(0);
        },

// returns the current state of the code.
        getCode: function () {
          return code.getCode();
        },

// returns the config Object that JSHint used to
// parse the code.
        getConfig: function () {
          return JSON.parse(JSON.stringify(config));
        },

// Iterator method. Returns Boolean if there is a next item
//
// Example:
// while (af.hasNext()) {
//   var a = af.next();
// }
        hasNext: function () {
          return (current < results.length);
        },

// Iterator method. Iterates through each error in the
// Array and returns an Object with fix and getDetails methods.
// if the end of the Array is reached then an error is thrown.
//
// fix function will fix the current error and return the state of the code.
// getDetails will return the current error's details including the config object.
        next: function () {
          if (!this.hasNext()) {
            throw new Error("End of list.");
          }

          var r = copyResults(results[current], config);
          var data = {
            fix: function () {
              fixError(r, code);
              return code.getCode();
            },
            getDetails: function () {
              return JSON.parse(JSON.stringify(r));
            }
          };
          current += 1;
          return data;
        },

// runs through all errors and fixes them.
// returns the fixed code.
        run: function () {
          return code.getCode();
        }
      };

      return api;
    }

    return fixMyJS;
  }());

// for node.js
// if module is available, we export to it.
  if (typeof module !== "undefined") {
    module.exports = exports.fixMyJS;
  }

}.call(this));
