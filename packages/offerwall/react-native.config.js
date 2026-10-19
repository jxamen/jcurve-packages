module.exports = {
  dependency: {
    platforms: {
      ios: { podspecPath: 'JCurveOfferwall.podspec' },
      android: {
        sourceDir: './android',
        packageImportPath: 'import kr.co.jcurve.offerwall.JCurveOfferwallPackage;',
        packageInstance: 'new JCurveOfferwallPackage()',
      },
    },
  },
};
