'use client'

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Lock, LockOpen, User } from "lucide-react"
import { getServiceRecords } from "@/app/actions/service-records" // <--- Importação nova
// Se você ainda não gerou os tipos novos, pode dar erro de TS aqui, mas vai funcionar
import type { Database } from "@/utils/database.types"

type ServiceRecord = Database['public']['Tables']['service_records']['Row'] & {
  professional: { full_name: string | null } | null
}

export function ServiceRecordList({ customerId }: { customerId: string }) {
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carrega os dados ao montar
    getServiceRecords(customerId).then((data) => {
      // @ts-ignore
      setRecords(data || [])
      setLoading(false)
    })
  }, [customerId])

  if (loading) return <div className="text-sm text-muted-foreground">Carregando histórico...</div>

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
        <p>Nenhum registro encontrado.</p>
        <span className="text-xs">Inicie um atendimento para criar o primeiro registro.</span>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-4">
        {records.map((record) => (
          <Card key={record.id} className="relative overflow-hidden">
            {/* Indicador Visual de Status (Assinado vs Rascunho) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              record.status === 'signed' ? 'bg-green-500' : 'bg-yellow-400'
            }`} />
            
            <CardHeader className="pb-2 pl-6">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {format(new Date(record.created_at!), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    <span className="text-xs font-normal text-muted-foreground">
                      às {format(new Date(record.created_at!), "HH:mm")}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">
                        <User className="h-2 w-2" />
                      </AvatarFallback>
                    </Avatar>
                    <span>{record.professional?.full_name || 'Profissional'}</span>
                  </div>
                </div>
                
                <Badge variant={record.status === 'signed' ? 'default' : 'secondary'} className="gap-1">
                  {record.status === 'signed' ? (
                    <><Lock className="h-3 w-3" /> Assinado</>
                  ) : (
                    <><LockOpen className="h-3 w-3" /> Rascunho</>
                  )}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pl-6 text-sm whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
              {record.content}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}