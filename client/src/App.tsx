import { RocketLaunch } from '@phosphor-icons/react';
import { Card, Space, Typography } from 'antd';

const { Paragraph, Text } = Typography;

export default function App() {
	return (
		<main className='flex min-h-screen items-center justify-center bg-slate-100 p-6'>
			<Card
				className='w-full max-w-2xl'
				title={
					<Space align='center' size={8}>
						<RocketLaunch size={20} weight='duotone' />
						<Text strong>Example Page</Text>
					</Space>
				}
			>
				<Space direction='vertical' size={8}>
					<Paragraph>
						<Text code>@phosphor-icons/react</Text> is installed. Replace <Text code>RocketLaunch</Text> with any icon
						from the Phosphor Icons catalog.
					</Paragraph>
					<div className='rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm'>
						Tailwind CSS utilities are enabled in this template.
					</div>
					<div className='flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white'>
						<RocketLaunch size={18} weight='fill' />
						<span>Tailwind utility classes are active.</span>
					</div>
					<Space align='center' size={8}>
						<RocketLaunch size={24} weight='fill' />
						<Text>Phosphor icon rendering works in this template.</Text>
					</Space>
				</Space>
			</Card>
		</main>
	);
}
