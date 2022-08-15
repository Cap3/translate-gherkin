class GherkinTranslator {
  constructor({ dialect, outputDirectory }) {
    this.dialect = dialect;
    this.outputDirectory = outputDirectory;
  }

  translate(fileName) {
    console.log(`Translating '${fileName}'...`);
  }
}

module.exports = GherkinTranslator;
