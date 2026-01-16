import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Store from './pages/Store';
import Evolution from './pages/Evolution';


export const PAGES = {
    "Welcome": Welcome,
    "Home": Home,
    "Store": Store,
    "Evolution": Evolution,
}

export const pagesConfig = {
    mainPage: "Welcome",
    Pages: PAGES,
};