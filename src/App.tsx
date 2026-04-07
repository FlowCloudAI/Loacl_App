import './App.css'
import "./api"
import {Button, SideBar, type SideBarItem, TabBar, type TabItem} from 'flowcloudai-ui'
import {getCurrentWindow} from "@tauri-apps/api/window";
import {type CSSProperties, useState, useEffect} from "react";
import ProjectSelection from "./pages/ProjectSelection";
import ProjectEditing from "./pages/ProjectEditing";
import Settings from "./pages/Settings";
import Plugins from "./pages/Plugins";

function App() {
    const win = getCurrentWindow();

    const [isMaximized, setIsMaximized] = useState(false);
    useEffect(() => {
        win.isMaximized().then(setIsMaximized);
        const unlisten = win.onResized(() => win.isMaximized().then(setIsMaximized));
        return () => {
            unlisten.then(f => f());
        };
    }, [win]);

    // Tabs 相关状态
    const [tabs, setTabs] = useState<TabItem[]>([]);
    const [activeKey, setActiveKey] = useState('1');

    // 新增标签
    const handleAdd = () => {
        const newKey = String(tabs.length + 1);
        setTabs([
            ...tabs,
            {
                key: newKey,
                label: `标签${newKey}`,
                closable: true,
            }
        ]);
        setActiveKey(newKey);
    };

    // 删除标签
    const handleClose = (key: string) => {
        const newTabs = tabs.filter(tab => tab.key !== key);
        setTabs(newTabs);

        if (activeKey === key) {
            const closedIndex = tabs.findIndex(tab => tab.key === key);
            const nextTab = newTabs[closedIndex] || newTabs[closedIndex - 1];
            if (nextTab) {
                setActiveKey(nextTab.key);
            }
        }
    };

    // 侧边栏相关状态
    const HomeIcon = (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round"/>
        </svg>)
    const SearchIcon = (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="7" strokeWidth="1.5"/>
            <path d="M16.5 16.5L21 21" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>)

    const PluginsIcon = (
        <svg viewBox="-150 -150 1324 1324" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M702.836 1021.673H104.727c-53.527 0-95.418-44.218-95.418-95.418V779.636c0-11.636 4.655-20.945 13.964-27.927 9.309-6.982 20.945-9.309 30.254-6.982 11.637 2.328 23.273 4.655 32.582 4.655 67.491 0 123.346-55.855 123.346-123.346S153.6 502.691 86.109 502.691c-9.309 0-20.945 2.327-32.582 4.654-11.636 2.328-20.945 0-30.254-6.981S9.309 484.073 9.309 472.436V325.818c0-53.527 44.218-95.418 95.418-95.418h107.055c-2.327-11.636-2.327-23.273-2.327-34.91 0-107.054 86.109-193.163 193.163-193.163s193.164 86.11 193.164 193.164c0 11.636 0 23.273-2.327 34.909h107.054c53.527 0 95.418 44.218 95.418 95.418v107.055h20.946c107.054 0 193.163 86.109 193.163 193.163S923.927 819.2 816.873 819.2h-20.946v107.055c4.655 51.2-39.563 95.418-93.09 95.418zM79.127 819.2v104.727c0 13.964 11.637 25.6 25.6 25.6h598.11c13.963 0 25.6-11.636 25.6-25.6V772.655c0-11.637 4.654-23.273 13.963-27.928 9.31-6.982 20.945-6.982 32.582-4.654 13.963 4.654 27.927 9.309 41.89 9.309 67.492 0 123.346-55.855 123.346-123.346s-55.854-123.345-123.345-123.345c-13.964 0-27.928 2.327-41.891 9.309-11.637 4.655-23.273 2.327-32.582-4.655-9.31-6.981-13.964-16.29-13.964-27.927v-153.6c0-13.963-11.636-25.6-25.6-25.6H546.91c-11.636 0-23.273-6.982-30.254-16.29-6.982-9.31-6.982-23.273-2.328-32.583 9.31-18.618 11.637-34.909 11.637-53.527 0-67.49-55.855-123.345-123.346-123.345s-123.345 55.854-123.345 123.345c0 18.618 4.654 37.237 11.636 53.527 4.655 11.637 4.655 23.273-2.327 32.582-6.982 9.31-18.618 16.291-30.255 16.291h-153.6c-13.963 0-25.6 11.637-25.6 25.6v104.727c109.382-4.654 200.146 83.782 200.146 193.164 0 107.055-86.11 193.164-193.164 193.164-2.327 2.327-4.654 2.327-6.982 2.327z"
                fill="currentColor"
            />
        </svg>)

    const SettingsIcon = (
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
            <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15 1.65 1.65 0 003.17 14H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68 1.65 1.65 0 0010 3.17V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>)

    const menuItems: SideBarItem[] = [
        {key: 'home', label: '首页', icon: HomeIcon},
        {key: 'search', label: '搜索', icon: SearchIcon},
        {key: 'plugins', label: '插件管理', icon: PluginsIcon},
    ]
    const bottomItems: SideBarItem[] = [
        {key: 'settings', label: '设置', icon: SettingsIcon},
    ]

    const [selectedKey, setSelectedKey] = useState('home')
    const [collapsed, setCollapsed] = useState(false)

    return (
        <div className="app-layout">
            <div className="top-bar" data-tauri-drag-region>
                <button className="menu-btn" data-tauri-drag-region>
                    <svg data-tauri-drag-region
                         xmlns="http://www.w3.org/2000/svg" width="512" height="512"
                         viewBox="0 0 512 512" fill="none">
                        <path
                            d="M362.34 234.141C324.97 212.705 258.916 226.767 258.728 286.513C241.793 230.641 315.033 173.27 382.462 199.768C418.083 213.767 439.643 242.766 447.642 275.326C466.139 350.384 405.459 389.506 333.594 385.944C280.288 383.319 255.541 352.071 218.108 330.823C209.484 325.885 195.674 319.011 183.3 317.948C158.178 315.824 141.743 322.386 127.37 331.323C146.742 310.511 174.926 298.637 199.611 299.45C245.105 300.949 277.101 334.072 324.032 335.76C407.397 342.947 405.834 259.14 362.277 234.141L362.34 234.141ZM209.984 134.21C241.48 117.024 281.1 118.149 312.534 136.522C322.47 142.335 340.718 157.271 344.967 168.02C336.093 160.271 318.033 142.772 268.227 150.709C227.982 157.146 199.673 199.206 202.298 236.453C177.488 234.079 152.304 232.454 131.119 254.202C117.183 268.514 106.497 290.263 108.059 316.886C109.434 340.384 125.557 360.508 142.118 369.695C151.992 375.132 162.615 378.445 174.676 380.007C189.924 382.007 216.421 378.882 232.106 370.57C164.053 410.443 85.9373 384.632 66.5022 332.26C46.6298 278.701 82.3752 217.205 144.93 211.955C152.179 211.33 155.429 211.018 159.366 211.33C167.74 170.27 178.926 151.146 209.922 134.21L209.984 134.21Z"
                            fill="url(#linear_fill_jAZk9lqyiGGO3cP1dJ5WO)"/>
                        <defs>
                            <linearGradient id="linear_fill_jAZk9lqyiGGO3cP1dJ5WO" x1="94.38400268554688"
                                            y1="140.4921875"
                                            x2="417.6159973144531" y2="371.5078125" gradientUnits="userSpaceOnUse">
                                <stop offset="0" stop-color="#0DBDED"/>
                                <stop offset="1" stop-color="#9C1FED"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </button>
                <div className={"tab-bar-wrapper"} data-tauri-drag-region>
                    <TabBar
                        background={"transparent"}
                        variant={"floating"}
                        tabRadius={"md"}
                        closable
                        draggable
                        addable
                        fillWidth={false}
                        tauriDragRegion
                        minTabWidth={"10rem"}
                        items={tabs}
                        activeKey={activeKey}
                        onReorder={setTabs}
                        onChange={(key) => {
                            console.log('切换到:', key);
                            setActiveKey(key);
                        }}
                        onClose={(key) => {
                            console.log('关闭:', key);
                            handleClose(key);
                        }}
                        onAdd={() => {
                            console.log('新增标签页');
                            handleAdd();
                        }}
                    />
                </div>
                <div className="top-bar-actions" data-tauri-drag-region>
                    <Button
                        variant="ghost"
                        onClick={() => win.minimize()}
                        style={{'--btn-bg-hover': 'var(--fc-color-bg-elevated)'} as CSSProperties}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                             strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => win.toggleMaximize()}
                        style={{'--btn-bg-hover': 'var(--fc-color-bg-elevated)'} as CSSProperties}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                             strokeLinejoin="round">
                            {isMaximized ? (
                                <>
                                    <rect x="2" y="6" width="16" height="12" rx="2"/>
                                    <path d="M 6 2 L 20 2 A 2 2 0 0 1 22 4 L 22 13"/>
                                </>
                            ) : (
                                <rect x="3" y="4.5" width="18" height="15" rx="2"/>
                            )}
                        </svg>
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => win.close()}
                        style={{'--btn-bg-hover': '#f00'} as CSSProperties}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                             strokeLinejoin="round">
                            <line x1="19" y1="5" x2="5" y2="19"/>
                            <line x1="5" y1="5" x2="19" y2="19"/>
                        </svg>
                    </Button>
                </div>
            </div>
            <div className="main-content">
                <SideBar
                    className={"side-bar"}
                    items={menuItems}
                    bottomItems={bottomItems}
                    selectedKey={selectedKey}
                    collapsed={collapsed}
                    width={150}
                    onSelect={setSelectedKey}
                    onCollapse={setCollapsed}
                />
                <div className="page-container">
                    <div className={`page-wrapper ${selectedKey === 'home' ? 'active' : ''}`}>
                        <ProjectSelection/>
                    </div>
                    <div className={`page-wrapper ${selectedKey === 'search' ? 'active' : ''}`}>
                        <ProjectEditing/>
                    </div>
                    <div className={`page-wrapper ${selectedKey === 'plugins' ? 'active' : ''}`}>
                        <Plugins/>
                    </div>
                    <div className={`page-wrapper ${selectedKey === 'settings' ? 'active' : ''}`}>
                        <Settings/>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
