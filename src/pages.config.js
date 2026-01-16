import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Store from './pages/Store';
import Evolution from './pages/Evolution';
import Achievements from './pages/Achievements';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';


export const PAGES = {
    "Welcome": Welcome,
    "Home": Home,
    "Store": Store,
    "Evolution": Evolution,
    "Achievements": Achievements,
    "Settings": Settings,
    "Inventory": Inventory,
}

export const pagesConfig = {
    mainPage: "Welcome",
    Pages: PAGES,
};