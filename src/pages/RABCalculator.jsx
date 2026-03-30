import { useState } from 'react'
import Sidebar from '../components/Dashboard/Sidebar'
import Header from '../components/Dashboard/Header'
import Footer from '../components/Dashboard/Footer'
import RABSidebar from '../components/RAB/Sidebar'
import MaterialsTab from '../components/RAB/MaterialsTab'
import WorkItemsTab from '../components/RAB/WorkItemsTab'
import CalculatorTab from '../components/RAB/CalculatorTab'
import RABAIConsultant from '../components/RAB/RABAIConsultant'

export default function RABCalculator() {
  const [appSidebarOpen, setAppSidebarOpen] = useState(true)
  const [rabTab, setRabTab] = useState('materials')
  const [rabPanelCollapsed, setRabPanelCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar isOpen={appSidebarOpen} onToggle={() => setAppSidebarOpen(!appSidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setAppSidebarOpen(!appSidebarOpen)} />

        <main className="flex-1 flex overflow-hidden min-h-0">
          <RABSidebar
            activeTab={rabTab}
            onTabChange={setRabTab}
            collapsed={rabPanelCollapsed}
            onToggleCollapse={() => setRabPanelCollapsed((c) => !c)}
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-6 min-w-0 bg-gray-50 dark:bg-gray-900">
            <div className={rabTab === 'materials' ? 'block' : 'hidden'}>
              <MaterialsTab />
            </div>
            <div className={rabTab === 'workItems' ? 'block' : 'hidden'}>
              <WorkItemsTab />
            </div>
            <div className={rabTab === 'calculator' ? 'block' : 'hidden'}>
              <CalculatorTab visible={rabTab === 'calculator'} />
            </div>
            <div className={rabTab === 'ai' ? 'block' : 'hidden'}>
              <RABAIConsultant />
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
