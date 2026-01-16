import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Store from './pages/Store';
import Evolution from './pages/Evolution';
import Achievements from './pages/Achievements';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Customize from './pages/Customize';
import AISettings from './pages/AISettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Welcome": Welcome,
    "Home": Home,
    "Store": Store,
    "Evolution": Evolution,
    "Achievements": Achievements,
    "Settings": Settings,
    "Inventory": Inventory,
    "Customize": Customize,
    "AISettings": AISettings,
}

export const pagesConfig = {
    mainPage: "Welcome",
    Pages: PAGES,
    Layout: __Layout,
};