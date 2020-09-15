/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import checkForUpdates from './src/lib/checkForUpdates';
import {download} from './src/lib/Network';

AppRegistry.registerComponent(appName, () => App);

/**
 * Download the latest app version from the server, and if it is different than the current one,
 * then refresh. If the page is visibile, prompt the user to refresh.
 *
 * @param {String} currentVersion
 */
function webUpdate(currentVersion) {
    download('version.json')
        .then((newVersion) => {
            if (newVersion !== currentVersion) {
                if (window.visibilityState === 'hidden') {
                    // Page is hidden, refresh immediately
                    window.location.reload(true);
                    return;
                }

                // Prompt user to refresh the page
                if (window.confirm('Refresh the page to get the latest updates!')) {
                    // TODO: Notify user in a less invasive way that they should refresh the page (i.e: Growl)
                    window.location.reload(true);
                }
            }
        });
}

/**
 * Create an object whose shape reflects the callbacks used in checkForUpdates.
 *
 * @param {String} currentVersion The version of the app that is currently running.
 * @returns {{init: Function, update: Function}}
 */
const webUpdater = currentVersion => ({
    init: () => {
        // We want to check for updates and refresh the page if necessary when the app is backgrounded.
        // That way, it will auto-update silently when they minimize the page,
        // and we don't bug the user any more than necessary :)
        window.addEventListener('visibilitychange', () => {
            if (window.visibilityState === 'hidden') {
                webUpdate(currentVersion);
            }
        });
    },
    update: () => webUpdate(currentVersion),
});

// When app loads, get current version
download('version.json')
    .then((currentVersion) => {
        checkForUpdates(webUpdater(currentVersion));
    });
