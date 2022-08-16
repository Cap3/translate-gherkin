# Translate Gherkin

This is a tool for the translation of Gherkin keywords in `*.feature` files.
Some Cucumber applications do only support specific dialects of the Gherkin syntax (e.g., only the default the `en` dialect).
To use such applications with other dialects, this tool can be used in a preprocessing step.

## Usage

To translate all features in the current directory to the English Gherkin dialect, use the following command.

```sh
npx github:cap3/translate-gherkin ./**/*.feature
```

> **⚠️ Warning:** By default the **input files are overwritten** by this tool, use the `--output` option to change this behavior.
> Always make sure to stage or commit your changes before using the `translate-gherkin` tool.

### Options

#### `-o, --output <directory>`

Sets the directory to write translated `*.feature` files to.
If the directory does not exist, it is created.
The file names and directory structure of the input files are preserved.

If this option is not specified, the input files are overwritten.

#### `-i, --input <directory>`

Sets a common prefix of all input files to ignore when creating the output files.

##### Example

The command

```sh
npx github:cap3/translate-gherkin  \
  --input specs                    \
  --output translated              \
  ./specs/first.feature            \
  ./specs/directory/second.feature
```

writes to the output files `./translated/first.feature` and `./translated/directory/second.feature`, i.e., the common prefix `./specs` is not part of the output file name.

#### `--dialect <language-code>`

The language code (usually two lower case letters) of the output dialect.
By default the target dialect is English `en`.
See the [Cucumber Documentation](https://cucumber.io/docs/gherkin/languages/) for a complete list of supported languages.

#### `-n, --dry-run`

When this flag is set, the input files are translated but the translation is not written to the output files.
The tool still displays all files that would be written to and the changes that would be made.

#### `-q, --quiet`

When this flag is set, the tool only prints the names of the input and output files but not a detailed list of all performed changes.

## Develpment

Before the tool can be executed during development, first install all dependencies of the package by running the following command in the repositories root directory.

```sh
npm install
```

To run the tool, use the following command.

```
node bin/translate.js
```

## Testing

There are some basic test cases in the `tests` directory.
Use the following command to run the tests.

```
npm test
```
