import _ from 'underscore';
import React from 'react';
import {View, SectionList} from 'react-native';
import PropTypes from 'prop-types';
import styles from '../styles/styles';
import KeyboardSpacer from './KeyboardSpacer';
import ChatLinkRow from '../pages/home/sidebar/ChatLinkRow';

const propTypes = {
    /** Extra styles for the section list container */
    contentContainerStyles: PropTypes.arrayOf(PropTypes.object),

    /** Sections for the section list */
    sections: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string,
        indexOffset: PropTypes.number,
        data: PropTypes.arrayOf(PropTypes.shape({})),
        shouldShow: PropTypes.bool,
    })),

    /** Index for option to focus on */
    focusedIndex: PropTypes.number,

    /** Array of already selected options */
    selectedOptions: PropTypes.arrayOf(PropTypes.shape({
        /** Text to display */
        text: PropTypes.string,

        /** Alternate text to display */
        alternateText: PropTypes.string,

        /** Array of icon urls */
        icons: PropTypes.arrayOf(PropTypes.string),

        /** Login (only present when there is a single participant) */
        login: PropTypes.string,

        /** reportID (only present when there is a matching report) */
        reportID: PropTypes.number,

        /** Whether the report has read or not */
        isUnread: PropTypes.bool,

        /** Whether the report has a draft comment or not */
        hasDraftComment: PropTypes.bool,

        /** Key used internally by React */
        keyForList: PropTypes.string,

        /** Search text we use to filter options */
        searchText: PropTypes.string,

        /** Whether the report is pinned or not */
        isPinned: PropTypes.bool,
    })),

    /** Whether we can select multiple options or not */
    canSelectMultipleOptions: PropTypes.bool,

    /** Whether to show headers above each section or not */
    hideSectionHeaders: PropTypes.bool,

    /** Callback to fire when a row is selected */
    onSelectRow: PropTypes.func,
};

const defaultProps = {
    contentContainerStyles: [],
    sections: [],
    focusedIndex: 0,
    selectedOptions: [],
    canSelectMultipleOptions: false,
    hideSectionHeaders: false,
    onSelectRow: () => {},
};

const OptionsList = ({
    contentContainerStyles,
    sections,
    focusedIndex,
    selectedOptions,
    canSelectMultipleOptions,
    hideSectionHeaders,
    onSelectRow,
}) => (
    <View style={[styles.flex1]}>
        <SectionList
            bounces={false}
            indicatorStyle="white"
            keyboardShouldPersistTaps="always"
            contentContainerStyle={[...contentContainerStyles]}
            showsVerticalScrollIndicator={false}
            sections={sections}
            keyExtractor={option => option.keyForList}
            initialNumToRender={200}
            renderItem={({item, index, section}) => (
                <ChatLinkRow
                    option={item}
                    optionIsFocused={focusedIndex === (index + section.indexOffset)}
                    onSelectRow={onSelectRow}
                    isSelected={_.find(selectedOptions, option => option.login === item.login)}
                    showSelectedState={canSelectMultipleOptions}
                />
            )}
            renderSectionHeader={({section: {title, shouldShow}}) => {
                if (title && shouldShow && !hideSectionHeaders) {
                    return (
                        <View>
                            <Text style={styles.subHeader}>
                                {title}
                            </Text>
                        </View>
                    );
                }

                return <View style={styles.mt1} />;
            }}
            extraData={focusedIndex}
        />
        <KeyboardSpacer />
    </View>
);

OptionsList.propTypes = propTypes;
OptionsList.displayName = 'OptionsList';
OptionsList.defaultProps = defaultProps;
export default OptionsList;
