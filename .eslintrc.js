module.exports = {
    env: {
        node: true,
        es6: true,
        jasmine: true
    },
    globals: {},
    extends: 'eslint:recommended',
    parserOptions: {
        sourceType: 'module'
    },
    rules: {
        "no-unused-vars": 0,
        "no-process-exit": 0,
        "no-alert": 2,
        "no-caller": 2,
        "no-bitwise": 0,
        "no-console": 0,
        "no-debugger": 2,
        "no-empty": 2,
        "no-eval": 1,
        "no-ex-assign": 2,
        "no-floating-decimal": 0,
        "no-implied-eval": 2,
        "no-with": 2,
        "no-fallthrough": 2,
        "no-unreachable": 2,
        "no-undef": 2,
        "no-undef-init": 2,
        "no-octal": 2,
        "no-obj-calls": 2,
        "no-new-wrappers": 2,
        "no-new": 2,
        "no-new-func": 2,
        "no-native-reassign": 2,
        "no-plusplus": 0,
        "no-delete-var": 2,
        "no-return-assign": 2,
        "no-new-object": 2,
        "no-label-var": 2,
        "no-ternary": 0,
        "no-self-compare": 0,
        "smarter-eqeqeq": 0,
        "brace-style": 0,
        "camelcase": 0,
        "curly": 2,
        "dot-notation": 0,
        "eqeqeq": 0,
        "new-parens": 2,
        "guard-for-in": 0,
        "radix": 0,
        "new-cap": 0,
        "quote-props": 0,
        "semi": 2,
        "use-isnan": 2,
        "quotes": [1, "single", "avoid-escape"],
        "max-params": [0, 3],
        "max-statements": [0, 10],
        "complexity": [0, 11],
        "wrap-iife": [1, "inside"],
        "no-multi-str": 2,
        "eol-last": 0,
        "no-trailing-spaces": 0,
        "no-shadow": 0,
        "consistent-return": 0,
        "no-extra-boolean-cast": 0,
        "no-shadow-restricted-names": 0,
        "comma-spacing": 2,
        "no-mixed-spaces-and-tabs": 2,
        "space-before-function-paren": ["error", "always"],
        "space-before-blocks": ["error", "always"],
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
        ],

        "max-len": [
            1,
            {
                "code": 120,
                "comments": 120
            }
        ],
    }
};
