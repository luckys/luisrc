import tokyoNight from '@shikijs/themes/tokyo-night'
import { ExpressiveCodeTheme } from 'astro-expressive-code'

const tokyoNightLight = new ExpressiveCodeTheme({
  ...tokyoNight,
  name: 'tokyo-night-light',
  type: 'light',
  colors: {
    ...tokyoNight.colors,
    'editor.background': '#f5f6fb',
    'editor.foreground': '#343b58',
    'editorLineNumber.foreground': '#9aa5ce',
    'editorLineNumber.activeForeground': '#565f89',
    'editor.selectionBackground': '#d7d9e4',
    'editor.inactiveSelectionBackground': '#e6e8f0',
    'editorIndentGuide.background1': '#d5d8e4',
    'editorIndentGuide.activeBackground1': '#a9b1d6',
    'editorCursor.foreground': '#34548a',
    'editorWhitespace.foreground': '#c0caf5',
    'editorGutter.background': '#f5f6fb',
    'activityBar.background': '#e9eaf2',
    'activityBar.border': '#e9eaf2',
    'activityBar.foreground': '#565f89',
    'sideBar.background': '#eef0f8',
    'sideBar.foreground': '#343b58',
    'panel.background': '#eef0f8',
    'panel.border': '#d5d7e5',
    'titleBar.activeBackground': '#e9eaf2',
    'titleBar.activeForeground': '#343b58',
    'statusBar.background': '#e9eaf2',
    'statusBar.foreground': '#343b58',
    'editorWidget.background': '#e9eaf2',
    'editorWidget.border': '#d5d7e5',
    'editorSuggestWidget.background': '#e9eaf2',
    'editorSuggestWidget.border': '#d5d7e5',
    'editorSuggestWidget.foreground': '#343b58',
    'editorOverviewRuler.border': '#e2e5ef',
    focusBorder: '#34548a',
  },
}).ensureMinSyntaxHighlightingColorContrast(5.5)

export default tokyoNightLight
