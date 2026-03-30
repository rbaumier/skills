# CA2: How should Tab and TabPanel share active state?

Use the **compound components** pattern with **Context + Provider** for shared state between children.

```tsx
const TabsContext = createContext<{ activeTab: string; setActiveTab: (id: string) => void }>(null!);

function Tabs({ children, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

function Tab({ id, children }: TabProps) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return <button onClick={() => setActiveTab(id)} data-active={activeTab === id}>{children}</button>;
}

function TabPanel({ id, children }: TabPanelProps) {
  const { activeTab } = useContext(TabsContext);
  return activeTab === id ? <div>{children}</div> : null;
}
```

The provider is the only place that knows state implementation. No prop drilling needed — children implicitly share state through context.
