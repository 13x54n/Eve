const { withPodfile } = require("expo/config-plugins");

const MARKER = "with-rncore-header-search";
const SEARCH_PATH = '"$(PODS_ROOT)/React-Core-prebuilt/React.xcframework/Headers"';
// Only ReactCodegen needs RCTRequired from the prebuilt xcframework. Applying
// this path to every pod (esp. AsyncStorage Swift) breaks Foundation/@objc.
const ALLOWED_TARGETS = ["ReactCodegen"];

const SNIPPET = `
    # @generated begin ${MARKER}
    rncore_headers = '${SEARCH_PATH}'
    allowed_rncore_header_targets = %w[${ALLOWED_TARGETS.join(" ")}]
    installer.pods_project.targets.each do |target|
      next unless allowed_rncore_header_targets.include?(target.name)
      target.build_configurations.each do |config|
        headers = config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'
        unless headers.to_s.include?('React.xcframework/Headers')
          config.build_settings['HEADER_SEARCH_PATHS'] = headers.is_a?(Array) ? (headers + [rncore_headers]) : "\#{headers} \#{rncore_headers}"
        end
      end
    end
    installer.pod_targets.each do |pod_target|
      next unless allowed_rncore_header_targets.include?(pod_target.name)
      pod_target.build_settings.each do |config_name, _build_settings|
        xcconfig_path = pod_target.xcconfig_path(config_name)
        next unless File.exist?(xcconfig_path)
        xcconfig = Xcodeproj::Config.new(xcconfig_path)
        paths = xcconfig.attributes['HEADER_SEARCH_PATHS'] || '$(inherited)'
        unless paths.include?('React.xcframework/Headers')
          xcconfig.attributes['HEADER_SEARCH_PATHS'] = "\#{paths} \#{rncore_headers}"
          xcconfig.save_as(xcconfig_path)
        end
      end
    end
    # #region agent log
    begin
      require 'json'
      File.open('/Users/lex-work/Eve/.cursor/debug-70c177.log', 'a') do |f|
        f.puts({
          sessionId: '70c177',
          runId: 'post-fix',
          hypothesisId: 'D',
          location: 'Podfile:post_install',
          message: 'scoped React.xcframework/Headers injection',
          data: { allowedTargets: allowed_rncore_header_targets, searchPath: 'React.xcframework/Headers' },
          timestamp: (Time.now.to_f * 1000).to_i
        }.to_json)
      end
    rescue
    end
    # #endregion
    # @generated end ${MARKER}
`;

const EXISTING_BLOCK_RE =
  /\n    # @generated begin with-rncore-header-search[\s\S]*?    # @generated end with-rncore-header-search\n/;

/** Adds prebuilt React.xcframework Headers for ReactCodegen only (RCTRequired). */
function withRncoreHeaderSearch(config) {
  return withPodfile(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes("react_native_post_install(")) {
      throw new Error(
        "Could not find react_native_post_install in Podfile to inject RNCore header search paths",
      );
    }

    if (EXISTING_BLOCK_RE.test(contents)) {
      cfg.modResults.contents = contents.replace(EXISTING_BLOCK_RE, `\n${SNIPPET}`);
      return cfg;
    }

    cfg.modResults.contents = contents.replace(
      /react_native_post_install\(\s*installer,[\s\S]*?\)\n/,
      (match) => `${match}${SNIPPET}`,
    );
    return cfg;
  });
}

module.exports = withRncoreHeaderSearch;
