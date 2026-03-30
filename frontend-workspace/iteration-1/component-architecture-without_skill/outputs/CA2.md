# CA2: How should Tab and TabPanel share active state?

You can manage the active tab state in the parent Tabs component and pass it down as props:

```tsx
function Tabs() {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div>
      <Tab index={0} activeTab={activeTab} onClick={setActiveTab}>Tab 1</Tab>
      <Tab index={1} activeTab={activeTab} onClick={setActiveTab}>Tab 2</Tab>
      <TabPanel active={activeTab === 0}>Content 1</TabPanel>
      <TabPanel active={activeTab === 1}>Content 2</TabPanel>
    </div>
  );
}
```

You could also use a state management library or React Context if the component tree gets deeper.
