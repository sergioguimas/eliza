'use client'

import { useState } from "react"
import { AlertCircle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function ExpensesCard({ data, expensesList }: { data: number, expensesList: any[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* O Card inteiro vira um botão interativo */}
        <Card className="border-red-500/20 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Despesas do Mês</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data)}
                </div>
                <p className="text-[10px] text-muted-foreground">Clique para detalhar</p>
              </div>
              <ArrowRight className="h-4 w-4 text-red-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" />
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="text-red-500" />
            Detalhamento de Despesas
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Aqui entra a sua lista de despesas com botões de ação */}
          {expensesList.length > 0 ? (
            expensesList.map((expense) => (
              <div key={expense.id} className="flex justify-between items-center p-3 border rounded-lg bg-secondary/20">
                <div>
                  <p className="font-medium text-sm">{expense.description}</p>
                  <p className="text-xs text-muted-foreground">Vence em: {new Date(expense.due_date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${expense.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expense.amount)}
                  </p>
                  <span className="text-[10px] uppercase font-bold opacity-70">
                    {expense.status === 'paid' ? 'Pago' : 'Pendente'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-10">Nenhuma despesa lançada.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}