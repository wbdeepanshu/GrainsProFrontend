import { Sidebar } from "lucide-react"
import {Outlet } from "react-router-dom"

const layout = ()=>{


    return (
        <>
        <Sidebar/>

        <main>
            <Outlet/>
        </main>
        </>
    )
}


export default layout