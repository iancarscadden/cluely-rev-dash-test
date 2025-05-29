"use client"
import { X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsPanelProps {
  splitRevenue: boolean
  setSplitRevenue: (value: boolean) => void
  onClose: () => void
}

export function SettingsPanel({ splitRevenue, setSplitRevenue, onClose }: SettingsPanelProps) {
  const handleSplitRevenueChange = (checked: boolean) => {
    console.log(`Settings: Split revenue changed to ${checked}`)
    setSplitRevenue(checked)
  }

  return (
    <Card className="mb-6 border-gray-200 shadow-lg bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-medium text-gray-800">Settings</CardTitle>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close settings"
        >
          <X size={20} className="text-gray-600" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="split-revenue" className="text-xl text-gray-800">
                Split Revenue Streams
              </Label>
              <p className="text-lg text-gray-600">Show separate lines for Cluely and Interview Coder</p>
            </div>
            <Switch id="split-revenue" checked={splitRevenue} onCheckedChange={handleSplitRevenueChange} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
