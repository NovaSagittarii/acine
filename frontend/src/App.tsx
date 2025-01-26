import Button from './components/Button';

function App() {
  return (
    <div className='w-screen h-screen p-8'>
      <div className='w-full h-full flex gap-4 rounded-sm border border-black/10'>
        <div className='w-full'>
          <div className='h-full p-8 flex flex-col gap-4'>
            <Button className='bg-red-400'>CAPTURE</Button>
            <div className='flex gap-4'>
              <Button className='bg-blue-200 w-full'>Click</Button>
              <Button className='bg-blue-200 w-full'>Click (Region)</Button>
              <Button className='bg-blue-200 w-full'>Drag</Button>
            </div>
            <div className='min-h-[12rem] bg-black text-white'>img here</div>
          </div>
        </div>
        <div className='w-2/3 p-8 flex flex-col gap-4'>
          <div className='h-full overflow-y-auto'>
            <>state</>
          </div>
          <Button className='bg-black text-white'>Add State</Button>
        </div>
      </div>
    </div>
  );
}

export default App;
