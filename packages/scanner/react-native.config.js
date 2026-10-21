module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import kr.co.jcurve.scanner.JcurveScannerPackage;',
        packageInstance: 'new JcurveScannerPackage()',
      },
      ios: null,
    },
  },
};
