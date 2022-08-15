const { program } = require("commander");
const chalk = require("chalk");
const GherkinTranslator = require("..");

program
  .name("npx translate-gherkin")
  .description(
    "This tool translates the keywords of `*.feature` files to a target " +
      "Gherkin dialect."
  )
  .showHelpAfterError("Add `--help` option for usage information.")
  .arguments("[input-files...]", "The feature files to translates.")
  .option(
    "--o, --output <directory>",
    "The output directory. By default the input files are overwritten."
  )
  .option(
    "--dialect <language-code>",
    "The two letter language code of the language to translate to."
  )
  .configureOutput({
    outputError: (str, write) => write(chalk.red.bold(str)),
  })
  .action(async (inputFiles, opts) => {
    if (inputFiles.length == 0) program.error("Error: No input files.");

    const translator = new GherkinTranslator({
      dialect: opts.dialect,
      outputDirectory: opts.output,
    });
    const promises = inputFiles.map(translator.translate);
    await Promise.all(promises);
  });

program.parse();
