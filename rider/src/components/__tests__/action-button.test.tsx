import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ActionButton } from '../action-button';

describe('ActionButton', () => {
  it('renders correctly with default props', () => {
    render(<ActionButton title="Test Button" onPress={() => {}} />);
    
    const button = screen.getByText('Test Button');
    expect(button).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ActionButton title="Press Me" onPress={onPressMock} />
    );
    
    const button = getByText('Press Me');
    button.props.onPress();
    
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('renders with custom variant', () => {
    const { getByText } = render(
      <ActionButton 
        title="Primary Button" 
        onPress={() => {}}
        variant="primary"
      />
    );
    
    expect(getByText('Primary Button')).toBeTruthy();
  });

  it('handles disabled state', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ActionButton 
        title="Disabled Button" 
        onPress={onPressMock}
        disabled
      />
    );
    
    const button = getByText('Disabled Button');
    expect(button).toBeTruthy();
  });
});
