import React from 'react';
import PropTypes from 'prop-types';
import {
    View,
    Dimensions,
    Animated,
    Easing,
    Keyboard,
} from 'react-native';
import {SafeAreaInsetsContext, SafeAreaProvider} from 'react-native-safe-area-context';
import {withOnyx} from 'react-native-onyx';
import {Route} from '../../libs/Router';
import styles, {getSafeAreaPadding, getNavigationMenuStyle} from '../../styles/styles';
import variables from '../../styles/variables';
import HeaderView from './HeaderView';
import Sidebar from './sidebar/SidebarView';
import SettingsPage from '../SettingsPage';
import Main from './MainView';
import {
    hide as hideSidebar,
    show as showSidebar,
    setIsAnimating as setSideBarIsAnimating,
} from '../../libs/actions/Sidebar';
import {
    subscribeToReportCommentEvents,
    fetchAll as fetchAllReports,
} from '../../libs/actions/Report';
import * as PersonalDetails from '../../libs/actions/PersonalDetails';
import * as Pusher from '../../libs/Pusher/pusher';
import PusherConnectionManager from '../../libs/PusherConnectionManager';
import UnreadIndicatorUpdater from '../../libs/UnreadIndicatorUpdater';
import ROUTES from '../../ROUTES';
import ONYXKEYS from '../../ONYXKEYS';
import Timing from '../../libs/actions/Timing';
import NetworkConnection from '../../libs/NetworkConnection';
import CONFIG from '../../CONFIG';
import CustomStatusBar from '../../components/CustomStatusBar';
import CONST from '../../CONST';
import {fetchCountryCodeByRequestIP} from '../../libs/actions/GeoLocation';
import KeyboardShortcut from '../../libs/KeyboardShortcut';
import * as ChatSwitcher from '../../libs/actions/ChatSwitcher';
import {redirect} from '../../libs/actions/App';

const propTypes = {
    isSidebarShown: PropTypes.bool,
    isChatSwitcherActive: PropTypes.bool,
    currentURL: PropTypes.string,
    network: PropTypes.shape({isOffline: PropTypes.bool}),
};
const defaultProps = {
    isSidebarShown: true,
    isChatSwitcherActive: false,
    currentURL: '',
    network: {isOffline: true},
};

class App extends React.Component {
    constructor(props) {
        Timing.start(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);
        Timing.start(CONST.TIMING.HOMEPAGE_REPORTS_LOADED);

        super(props);

        const windowSize = Dimensions.get('window');
        const isSmallScreenWidth = windowSize.width <= variables.mobileResponsiveWidthBreakpoint;
        this.state = {
            windowWidth: windowSize.width,
            isSmallScreenWidth,
            isCreateMenuActive: false,
        };

        this.onCreateMenuItemSelected = this.onCreateMenuItemSelected.bind(this);
        this.toggleCreateMenu = this.toggleCreateMenu.bind(this);
        this.toggleNavigationMenu = this.toggleNavigationMenu.bind(this);
        this.dismissNavigationMenu = this.dismissNavigationMenu.bind(this);
        this.showNavigationMenu = this.showNavigationMenu.bind(this);
        this.toggleNavigationMenuBasedOnDimensions = this.toggleNavigationMenuBasedOnDimensions.bind(this);
        this.recordTimerAndToggleNavigationMenu = this.recordTimerAndToggleNavigationMenu.bind(this);
        this.navigateToSettings = this.navigateToSettings.bind(this);

        const windowBarSize = isSmallScreenWidth
            ? -this.state.windowWidth
            : -variables.sideBarWidth;
        this.animationTranslateX = new Animated.Value(
            !props.isSidebarShown ? windowBarSize : 0,
        );
    }

    componentDidMount() {
        NetworkConnection.listenForReconnect();
        PusherConnectionManager.init();
        Pusher.init({
            appKey: CONFIG.PUSHER.APP_KEY,
            cluster: CONFIG.PUSHER.CLUSTER,
            authEndpoint: `${CONFIG.EXPENSIFY.URL_API_ROOT}api?command=Push_Authenticate`,
        }).then(subscribeToReportCommentEvents);

        // Fetch some data we need on initialization
        PersonalDetails.fetch();
        PersonalDetails.fetchTimezone();
        fetchAllReports(true, false, true);
        fetchCountryCodeByRequestIP();
        UnreadIndicatorUpdater.listenForReportChanges();
        Dimensions.addEventListener('change', this.toggleNavigationMenuBasedOnDimensions);

        // Refresh the personal details and timezone every 30 minutes because there is no
        // pusher event that sends updated personal details data yet
        // See https://github.com/Expensify/ReactNativeChat/issues/468
        this.interval = setInterval(() => {
            if (this.props.network.isOffline) {
                return;
            }
            PersonalDetails.fetch();
            PersonalDetails.fetchTimezone();
        }, 1000 * 60 * 30);

        // Set up the navigationMenu correctly once on init
        if (!this.state.isSmallScreenWidth) {
            showSidebar();
        }

        Timing.end(CONST.TIMING.HOMEPAGE_INITIAL_RENDER);

        // Listen for the Command+K key being pressed so the focus can be given to the chat switcher
        KeyboardShortcut.subscribe('K', () => {
            ChatSwitcher.show();
        }, ['meta'], true);
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.isChatSwitcherActive && this.props.isChatSwitcherActive) {
            this.showNavigationMenu();
        }
        if (this.props.isSidebarShown === prevProps.isSidebarShown) {
            // Nothing changed, don't trigger animation or re-render
            return;
        }
        this.animateNavigationMenu(prevProps.isSidebarShown);
    }

    componentWillUnmount() {
        Dimensions.removeEventListener('change', this.toggleNavigationMenuBasedOnDimensions);
        KeyboardShortcut.unsubscribe('K');
        NetworkConnection.stopListeningForReconnect();
        clearInterval(this.interval);
        this.interval = null;
    }

    /**
     * Method called when a Create Menu item is selected.
     */
    onCreateMenuItemSelected() {
        this.toggleCreateMenu();
        ChatSwitcher.show();
    }

    /**
     * Method called when a pinned chat is selected.
     */
    recordTimerAndToggleNavigationMenu() {
        Timing.start(CONST.TIMING.SWITCH_REPORT);
        this.toggleNavigationMenu();
    }

    /**
     * Method called when avatar is clicked
     */
    navigateToSettings() {
        redirect(ROUTES.SETTINGS);
        this.toggleNavigationMenu();
    }

    /**
     * Method called when we click the floating action button
     * will trigger the animation
     * Method called either when:
     * Pressing the floating action button to open the CreateMenu modal
     * Selecting an item on CreateMenu or closing it by clicking outside of the modal component
     */
    toggleCreateMenu() {
        // Prevent from possibly toggling the create menu with the sidebar hidden
        if (!this.props.isSidebarShown) {
            return;
        }
        this.setState(state => ({
            isCreateMenuActive: !state.isCreateMenuActive,
        }));
    }

    /**
     * Fired when the windows dimensions changes
     * @param {Object} changedWindow
     */
    toggleNavigationMenuBasedOnDimensions({window: changedWindow}) {
        if (this.state.windowWidth === changedWindow.width) {
            // Window width hasn't changed, don't toggle sidebar
            return;
        }

        const isSmallScreenWidth = changedWindow.width <= variables.mobileResponsiveWidthBreakpoint;

        // Always show the sidebar if we are moving from small to large screens
        if (this.state.isSmallScreenWidth && !isSmallScreenWidth) {
            showSidebar();
        }

        this.setState({
            windowWidth: changedWindow.width,
            isSmallScreenWidth,
        });
    }

    /**
     * Method called when we want to dismiss the navigationMenu,
     * will not do anything if it already closed
     * Only changes navigationMenu state on small screens (e.g. Mobile and mWeb)
     */
    dismissNavigationMenu() {
        if (!this.state.isSmallScreenWidth || !this.props.isSidebarShown) {
            return;
        }

        this.animateNavigationMenu(true);
    }

    /**
     * Method called when we want to show the navigationMenu,
     * will not do anything if it already open
     * Only changes navigationMenu state on smaller screens (e.g. Mobile and mWeb)
     */
    showNavigationMenu() {
        if (this.props.isSidebarShown) {
            return;
        }

        this.toggleNavigationMenu();
    }

    /**
     * Animates the navigationMenu in and out.
     *
     * @param {Boolean} navigationMenuIsShown
     */
    animateNavigationMenu(navigationMenuIsShown) {
        const windowSideBarSize = this.state.isSmallScreenWidth
            ? -variables.sideBarWidth
            : -this.state.windowWidth;
        const animationFinalValue = navigationMenuIsShown ? windowSideBarSize : 0;

        setSideBarIsAnimating(true);
        Animated.timing(this.animationTranslateX, {
            toValue: animationFinalValue,
            duration: 200,
            easing: Easing.ease,
            useNativeDriver: false,
        }).start(({finished}) => {
            if (finished && navigationMenuIsShown) {
                hideSidebar();
            }

            if (finished) {
                setSideBarIsAnimating(false);
            }
        });
    }

    /**
     * Method called when we want to toggle the navigationMenu opened and closed
     * Only changes navigationMenu state on small screens (e.g. Mobile and mWeb)
     */
    toggleNavigationMenu() {
        if (!this.state.isSmallScreenWidth) {
            return;
        }

        // Dismiss keyboard before toggling sidebar
        Keyboard.dismiss();

        // If the navigationMenu currently is not shown, we want to make it visible before the animation
        if (!this.props.isSidebarShown) {
            showSidebar();
            return;
        }

        // Otherwise, we want to hide it after the animation
        this.animateNavigationMenu(true);
    }

    render() {
        return (
            <SafeAreaProvider>
                <CustomStatusBar />
                <SafeAreaInsetsContext.Consumer style={[styles.flex1]}>
                    {insets => (
                        <View
                            style={[styles.appContentWrapper,
                                styles.flexRow,
                                styles.flex1,
                                getSafeAreaPadding(insets),
                            ]}
                        >
                            <Route path={[ROUTES.REPORT, ROUTES.HOME, ROUTES.SETTINGS]}>
                                <Animated.View style={[
                                    getNavigationMenuStyle(this.state.windowWidth, this.props.isSidebarShown),
                                    {
                                        transform: [{translateX: this.animationTranslateX}],
                                    }]}
                                >
                                    <Sidebar
                                        insets={insets}
                                        onLinkClick={this.recordTimerAndToggleNavigationMenu}
                                        onAvatarClick={this.navigateToSettings}
                                        isCreateMenuActive={this.state.isCreateMenuActive}
                                        toggleCreateMenu={this.toggleCreateMenu}
                                        onCreateMenuItemSelected={this.onCreateMenuItemSelected}
                                    />
                                </Animated.View>
                                <View
                                    style={[styles.appContent, styles.flex1, styles.flexColumn]}
                                >
                                    <HeaderView
                                        shouldShowNavigationMenuButton={this.state.isSmallScreenWidth}
                                        onNavigationMenuButtonClicked={this.toggleNavigationMenu}
                                    />
                                    {this.props.currentURL === '/settings' && <SettingsPage />}
                                    <Main />
                                </View>
                            </Route>
                        </View>
                    )}
                </SafeAreaInsetsContext.Consumer>
            </SafeAreaProvider>
        );
    }
}

App.propTypes = propTypes;
App.defaultProps = defaultProps;

export default withOnyx(
    {
        isSidebarShown: {
            key: ONYXKEYS.IS_SIDEBAR_SHOWN,
        },
        isChatSwitcherActive: {
            key: ONYXKEYS.IS_CHAT_SWITCHER_ACTIVE,
            initWithStoredValues: false,
        },
        currentURL: {
            key: ONYXKEYS.CURRENT_URL,
        },
        network: {
            key: ONYXKEYS.NETWORK,
        },
    },
)(App);
