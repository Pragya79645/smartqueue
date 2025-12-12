import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CounterCard({ title, value, status }: { title: string, value: string, status?: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {status && <p className="text-xs text-muted-foreground">{status}</p>}
            </CardContent>
        </Card>
    )
}
